import crypto from 'crypto';
import { prisma } from '../config/database';
import { redis, redisKeys } from '../config/redis';
import { config } from '../config';
import { logger } from '../config/logger';
import {
  hashPassword,
  verifyPassword,
  validatePasswordPolicy,
  isPasswordExpired,
} from '../utils/password';
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  generateSecureToken,
  hashRefreshToken,
  hashToken,
  getRefreshTokenExpiry,
} from '../utils/tokens';
import { writeAuditLog } from '../utils/audit';
import type { AuthenticatedUser } from '../types';

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;
const CONCURRENT_SESSION_DEFAULT = 3;

export interface LoginResult {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    mustChangePassword: boolean;
    mfaEnabled: boolean;
    mfaPending?: boolean;
  };
}

export interface RefreshResult {
  accessToken: string;
  refreshToken: string;
}

// ── Login ─────────────────────────────────────────────────────────────────────

export async function loginWithPassword(
  email: string,
  password: string,
  ipAddress: string,
  userAgent: string,
): Promise<{ result?: LoginResult; mfaPending?: boolean; userId?: string; error?: string }> {
  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase().trim(), isDeleted: false },
  });

  if (!user || !user.passwordHash) {
    await writeAuditLog({
      actorIpAddress: ipAddress,
      actorUserAgent: userAgent,
      action: 'USER_LOGIN_FAILED',
      resourceType: 'User',
      resourceId: email,
      metadata: { reason: 'user_not_found' },
    });
    return { error: 'Invalid email or password.' };
  }

  // Check lockout
  if (user.isLocked) {
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      await writeAuditLog({
        actorUserId: user.id,
        actorIpAddress: ipAddress,
        actorUserAgent: userAgent,
        action: 'USER_LOGIN_FAILED',
        resourceType: 'User',
        resourceId: user.id,
        metadata: { reason: 'account_locked' },
      });
      return { error: 'Account is temporarily locked. Please try again later.' };
    }
    // Lockout expired — reset
    await prisma.user.update({
      where: { id: user.id },
      data: { isLocked: false, lockedUntil: null, failedLoginAttempts: 0 },
    });
  }

  const passwordValid = await verifyPassword(password, user.passwordHash);

  if (!passwordValid) {
    const newAttempts = user.failedLoginAttempts + 1;
    const shouldLock = newAttempts >= MAX_FAILED_ATTEMPTS;
    const lockedUntil = shouldLock
      ? new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000)
      : null;

    await prisma.user.update({
      where: { id: user.id },
      data: {
        failedLoginAttempts: newAttempts,
        isLocked: shouldLock,
        lockedUntil,
      },
    });

    await writeAuditLog({
      actorUserId: user.id,
      actorIpAddress: ipAddress,
      actorUserAgent: userAgent,
      action: shouldLock ? 'USER_LOCKED' : 'USER_LOGIN_FAILED',
      resourceType: 'User',
      resourceId: user.id,
      metadata: { attempts: newAttempts, locked: shouldLock },
    });

    if (shouldLock) {
      return { error: 'Too many failed attempts. Account locked for 15 minutes.' };
    }
    return { error: 'Invalid email or password.' };
  }

  // Reset failed attempts on success
  await prisma.user.update({
    where: { id: user.id },
    data: { failedLoginAttempts: 0, isLocked: false, lockedUntil: null },
  });

  // MFA required — issue a short-lived pending marker, not a full session
  if (user.mfaEnabled) {
    const pendingKey = redisKeys.mfaPending(user.id);
    await redis.set(pendingKey, '1', 'EX', 300); // 5 min window to complete MFA
    return { mfaPending: true, userId: user.id };
  }

  const result = await createSession(user, ipAddress, userAgent);
  return { result };
}

// ── MFA completion after password success ─────────────────────────────────────

export async function completeMfaLogin(
  userId: string,
  ipAddress: string,
  userAgent: string,
): Promise<LoginResult> {
  await redis.del(redisKeys.mfaPending(userId));
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  return createSession(user, ipAddress, userAgent);
}

// ── Session creation ──────────────────────────────────────────────────────────

async function createSession(
  user: { id: string; email: string; firstName: string; lastName: string; healthSystemId: string; mustChangePassword: boolean; passwordChangedAt: Date | null; mfaEnabled: boolean },
  ipAddress: string,
  userAgent: string,
): Promise<LoginResult> {
  // Enforce concurrent session limit from health system settings
  const healthSystem = await prisma.healthSystem.findUniqueOrThrow({
    where: { id: user.healthSystemId },
    select: { settings: true },
  });
  const settings = healthSystem.settings as Record<string, unknown>;
  const maxSessions: number =
    (settings?.maxConcurrentSessions as number) ?? CONCURRENT_SESSION_DEFAULT;

  // Count active non-expired sessions
  const activeSessions = await prisma.session.count({
    where: {
      userId: user.id,
      isRevoked: false,
      expiresAt: { gt: new Date() },
    },
  });

  if (activeSessions >= maxSessions) {
    // Revoke the oldest session to make room
    const oldest = await prisma.session.findFirst({
      where: { userId: user.id, isRevoked: false },
      orderBy: { lastUsedAt: 'asc' },
    });
    if (oldest) {
      await prisma.session.update({
        where: { id: oldest.id },
        data: { isRevoked: true },
      });
    }
  }

  const refreshTokenRaw = crypto.randomBytes(40).toString('hex');
  const refreshTokenHash = hashRefreshToken(refreshTokenRaw);
  const sessionExpiry = getRefreshTokenExpiry();

  const session = await prisma.session.create({
    data: {
      userId: user.id,
      refreshToken: refreshTokenHash,
      ipAddress,
      userAgent,
      deviceInfo: parseDevice(userAgent),
      expiresAt: sessionExpiry,
      lastUsedAt: new Date(),
    },
  });

  const roles = await prisma.userFacilityRole.findMany({
    where: { userId: user.id, isDeleted: false },
    select: { facilityId: true },
  });

  const accessToken = signAccessToken({
    sub: user.id,
    email: user.email,
    sessionId: session.id,
  });
  const refreshToken = signRefreshToken({
    sub: user.id,
    email: user.email,
    sessionId: session.id,
  });

  // Store the raw refresh token value so we can rotate it
  // We sign the JWT whose payload contains the session ID for lookup
  // The hashed raw token is stored for revocation

  const mustChangePassword = user.mustChangePassword || isPasswordExpired(user.passwordChangedAt);

  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });

  await writeAuditLog({
    actorUserId: user.id,
    actorIpAddress: ipAddress,
    actorUserAgent: userAgent,
    action: 'USER_LOGIN',
    resourceType: 'User',
    resourceId: user.id,
    metadata: { sessionId: session.id },
  });

  return {
    accessToken,
    refreshToken: refreshTokenRaw, // raw value sent to client in HttpOnly cookie
    user: {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      mustChangePassword,
      mfaEnabled: user.mfaEnabled,
    },
  };
}

// ── Refresh token rotation ────────────────────────────────────────────────────

export async function rotateRefreshToken(
  incomingRawToken: string,
  ipAddress: string,
  userAgent: string,
): Promise<RefreshResult | null> {
  let payload;
  try {
    payload = verifyRefreshToken(incomingRawToken);
  } catch {
    return null;
  }

  const session = await prisma.session.findUnique({
    where: { id: payload.sessionId },
  });

  if (!session || session.isRevoked || session.expiresAt < new Date()) {
    return null;
  }

  const user = await prisma.user.findUnique({
    where: { id: payload.sub, isDeleted: false, isActive: true },
  });
  if (!user) return null;

  // Rotate: issue new refresh token, invalidate old session, create new session
  const newRefreshRaw = crypto.randomBytes(40).toString('hex');
  const newRefreshHash = hashRefreshToken(newRefreshRaw);
  const newExpiry = getRefreshTokenExpiry();

  await prisma.$transaction([
    prisma.session.update({ where: { id: session.id }, data: { isRevoked: true } }),
    prisma.session.create({
      data: {
        userId: user.id,
        refreshToken: newRefreshHash,
        ipAddress,
        userAgent,
        deviceInfo: parseDevice(userAgent),
        expiresAt: newExpiry,
        lastUsedAt: new Date(),
      },
    }),
  ]);

  const newSession = await prisma.session.findFirst({
    where: { userId: user.id, refreshToken: newRefreshHash },
  });

  const accessToken = signAccessToken({
    sub: user.id,
    email: user.email,
    sessionId: newSession!.id,
  });
  const refreshToken = signRefreshToken({
    sub: user.id,
    email: user.email,
    sessionId: newSession!.id,
  });

  return { accessToken, refreshToken: newRefreshRaw };
}

// ── Logout ────────────────────────────────────────────────────────────────────

export async function logout(
  sessionId: string,
  userId: string,
  ipAddress: string,
  userAgent: string,
): Promise<void> {
  await prisma.session.updateMany({
    where: { id: sessionId, userId },
    data: { isRevoked: true },
  });

  await writeAuditLog({
    actorUserId: userId,
    actorIpAddress: ipAddress,
    actorUserAgent: userAgent,
    action: 'USER_LOGOUT',
    resourceType: 'User',
    resourceId: userId,
    metadata: { sessionId },
  });
}

// ── Password reset ────────────────────────────────────────────────────────────

export async function requestPasswordReset(email: string): Promise<string | null> {
  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase().trim(), isDeleted: false, isActive: true },
  });
  if (!user) return null; // Don't reveal whether the email exists

  const { raw, hash } = generateSecureToken();
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

  // Invalidate any existing tokens for this user
  await prisma.passwordResetToken.updateMany({
    where: { userId: user.id, usedAt: null },
    data: { usedAt: new Date() },
  });

  await prisma.passwordResetToken.create({
    data: { userId: user.id, tokenHash: hash, expiresAt },
  });

  await writeAuditLog({
    actorUserId: user.id,
    action: 'USER_PASSWORD_RESET',
    resourceType: 'User',
    resourceId: user.id,
    metadata: { type: 'reset_requested' },
  });

  return raw;
}

export async function resetPassword(
  rawToken: string,
  newPassword: string,
): Promise<{ success: boolean; message: string }> {
  const hash = hashToken(rawToken);
  const record = await prisma.passwordResetToken.findUnique({
    where: { tokenHash: hash },
    include: { user: true },
  });

  if (!record || record.usedAt || record.expiresAt < new Date()) {
    return { success: false, message: 'Reset token is invalid or has expired.' };
  }

  const policy = validatePasswordPolicy(newPassword);
  if (!policy.valid) {
    return { success: false, message: policy.message! };
  }

  const passwordHash = await hashPassword(newPassword);
  await prisma.$transaction([
    prisma.user.update({
      where: { id: record.userId },
      data: {
        passwordHash,
        mustChangePassword: false,
        passwordChangedAt: new Date(),
        failedLoginAttempts: 0,
        isLocked: false,
        lockedUntil: null,
      },
    }),
    prisma.passwordResetToken.update({
      where: { id: record.id },
      data: { usedAt: new Date() },
    }),
    // Revoke all existing sessions on password reset
    prisma.session.updateMany({
      where: { userId: record.userId },
      data: { isRevoked: true },
    }),
  ]);

  await writeAuditLog({
    actorUserId: record.userId,
    action: 'USER_PASSWORD_RESET',
    resourceType: 'User',
    resourceId: record.userId,
    metadata: { type: 'reset_completed' },
  });

  return { success: true, message: 'Password reset successfully.' };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function parseDevice(userAgent: string): string {
  if (/mobile/i.test(userAgent)) return 'Mobile';
  if (/tablet/i.test(userAgent)) return 'Tablet';
  return 'Desktop';
}
