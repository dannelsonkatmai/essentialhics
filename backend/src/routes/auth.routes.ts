import { Router, Request, Response } from 'express';
import { z } from 'zod';
import rateLimit from 'express-rate-limit';
import { config } from '../config';
import { validate } from '../middleware/validate.middleware';
import { requireAuth } from '../middleware/auth.middleware';
import {
  loginWithPassword,
  completeMfaLogin,
  rotateRefreshToken,
  logout,
  requestPasswordReset,
  resetPassword,
} from '../services/auth.service';
import {
  enrollMfa,
  verifyTotp,
  verifyBackupCode,
  disableMfa,
  regenerateBackupCodes,
} from '../services/mfa.service';
import { sendPasswordResetEmail } from '../services/email.service';
import { extractRequestMeta } from '../utils/audit';
import { validatePasswordPolicy, hashPassword } from '../utils/password';
import { prisma } from '../config/database';
import { writeAuditLog } from '../utils/audit';
import type { AuthenticatedRequest } from '../types';

const router = Router();

const COOKIE_NAME = 'hics_refresh';
const cookieOptions = {
  httpOnly: true,
  secure: config.NODE_ENV === 'production',
  sameSite: 'strict' as const,
  maxAge: 8 * 60 * 60 * 1000, // 8 hours
  path: '/auth/refresh',
};

// ── Rate limiters ─────────────────────────────────────────────────────────────

const loginLimiter = rateLimit({
  windowMs: config.RATE_LIMIT_LOGIN_WINDOW_MS,
  max: config.RATE_LIMIT_LOGIN_MAX,
  message: { message: 'Too many login attempts. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const refreshLimiter = rateLimit({
  windowMs: config.RATE_LIMIT_REFRESH_WINDOW_MS,
  max: config.RATE_LIMIT_REFRESH_MAX,
  message: { message: 'Too many refresh requests.' },
});

const resetLimiter = rateLimit({
  windowMs: config.RATE_LIMIT_RESET_WINDOW_MS,
  max: config.RATE_LIMIT_RESET_MAX,
  message: { message: 'Too many password reset requests. Please try again later.' },
});

// ── Schemas ───────────────────────────────────────────────────────────────────

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const mfaVerifySchema = z.object({
  code: z.string().min(4).max(12),
  userId: z.string().uuid(),
  isBackupCode: z.boolean().optional().default(false),
});

const forgotPasswordSchema = z.object({
  email: z.string().email(),
});

const resetPasswordSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(12),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(12),
});

// ── Routes ────────────────────────────────────────────────────────────────────

// POST /auth/login
router.post('/login', loginLimiter, validate(loginSchema), async (req: Request, res: Response) => {
  const { email, password } = req.body;
  const { actorIpAddress, actorUserAgent } = extractRequestMeta(req);

  const outcome = await loginWithPassword(email, password, actorIpAddress, actorUserAgent);

  if (outcome.error) {
    res.status(401).json({ message: outcome.error });
    return;
  }

  if (outcome.mfaPending) {
    res.json({ mfaRequired: true, userId: outcome.userId });
    return;
  }

  const { result } = outcome;
  res.cookie(COOKIE_NAME, result!.refreshToken, cookieOptions);
  res.json({ accessToken: result!.accessToken, user: result!.user });
});

// POST /auth/mfa/verify  — complete login after MFA
router.post('/mfa/verify', loginLimiter, validate(mfaVerifySchema), async (req: Request, res: Response) => {
  const { code, userId, isBackupCode } = req.body;
  const { actorIpAddress, actorUserAgent } = extractRequestMeta(req);

  const valid = isBackupCode
    ? await verifyBackupCode(userId, code)
    : await verifyTotp(userId, code);

  if (!valid) {
    res.status(401).json({ message: 'Invalid MFA code.' });
    return;
  }

  const result = await completeMfaLogin(userId, actorIpAddress, actorUserAgent);
  res.cookie(COOKIE_NAME, result.refreshToken, cookieOptions);
  res.json({ accessToken: result.accessToken, user: result.user });
});

// POST /auth/refresh  — rotate refresh token
router.post('/refresh', refreshLimiter, async (req: Request, res: Response) => {
  const incomingToken = req.cookies?.[COOKIE_NAME];
  if (!incomingToken) {
    res.status(401).json({ message: 'No refresh token.' });
    return;
  }

  const { actorIpAddress, actorUserAgent } = extractRequestMeta(req);
  const result = await rotateRefreshToken(incomingToken, actorIpAddress, actorUserAgent);

  if (!result) {
    res.clearCookie(COOKIE_NAME, { path: '/auth/refresh' });
    res.status(401).json({ message: 'Refresh token is invalid or expired.' });
    return;
  }

  res.cookie(COOKIE_NAME, result.refreshToken, cookieOptions);
  res.json({ accessToken: result.accessToken });
});

// POST /auth/logout
router.post('/logout', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const { actorIpAddress, actorUserAgent } = extractRequestMeta(req);
  await logout(req.user.sessionId, req.user.id, actorIpAddress, actorUserAgent);
  res.clearCookie(COOKIE_NAME, { path: '/auth/refresh' });
  res.json({ message: 'Logged out.' });
});

// POST /auth/forgot-password
router.post('/forgot-password', resetLimiter, validate(forgotPasswordSchema), async (req: Request, res: Response) => {
  const { email } = req.body;
  const rawToken = await requestPasswordReset(email);

  if (rawToken) {
    const user = await prisma.user.findUnique({ where: { email } });
    if (user) {
      const resetUrl = `${config.FRONTEND_URL}/reset-password?token=${rawToken}`;
      await sendPasswordResetEmail(email, user.firstName, resetUrl);
    }
  }

  // Always return 200 — don't reveal if email exists
  res.json({ message: 'If that email is registered, a reset link has been sent.' });
});

// POST /auth/reset-password
router.post('/reset-password', resetLimiter, validate(resetPasswordSchema), async (req: Request, res: Response) => {
  const { token, password } = req.body;
  const result = await resetPassword(token, password);
  if (!result.success) {
    res.status(400).json({ message: result.message });
    return;
  }
  res.json({ message: result.message });
});

// POST /auth/change-password  (authenticated, force-change or voluntary)
router.post('/change-password', requireAuth, validate(changePasswordSchema), async (req: AuthenticatedRequest, res: Response) => {
  const { currentPassword, newPassword } = req.body;
  const { actorIpAddress, actorUserAgent } = extractRequestMeta(req);

  const user = await prisma.user.findUniqueOrThrow({
    where: { id: req.user.id },
    select: { passwordHash: true },
  });

  if (!user.passwordHash) {
    res.status(400).json({ message: 'Password change not available for SSO accounts.' });
    return;
  }

  const { verifyPassword } = await import('../utils/password');
  const valid = await verifyPassword(currentPassword, user.passwordHash);
  if (!valid) {
    res.status(401).json({ message: 'Current password is incorrect.' });
    return;
  }

  const policy = validatePasswordPolicy(newPassword);
  if (!policy.valid) {
    res.status(400).json({ message: policy.message });
    return;
  }

  const newHash = await hashPassword(newPassword);
  await prisma.user.update({
    where: { id: req.user.id },
    data: { passwordHash: newHash, mustChangePassword: false, passwordChangedAt: new Date() },
  });

  // Revoke all OTHER sessions on password change
  await prisma.session.updateMany({
    where: { userId: req.user.id, id: { not: req.user.sessionId } },
    data: { isRevoked: true },
  });

  await writeAuditLog({
    actorUserId: req.user.id,
    actorIpAddress,
    actorUserAgent,
    action: 'USER_UPDATED',
    resourceType: 'User',
    resourceId: req.user.id,
    metadata: { type: 'password_changed' },
  });

  res.json({ message: 'Password changed successfully.' });
});

// ── MFA management (authenticated) ───────────────────────────────────────────

// POST /auth/mfa/enroll
router.post('/mfa/enroll', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const { actorIpAddress, actorUserAgent } = extractRequestMeta(req);
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: req.user.id },
    select: { email: true, mfaEnabled: true },
  });

  if (user.mfaEnabled) {
    res.status(400).json({ message: 'MFA is already enabled.' });
    return;
  }

  const result = await enrollMfa(req.user.id, user.email, actorIpAddress, actorUserAgent);
  res.json(result);
});

// POST /auth/mfa/disable
router.post('/mfa/disable', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const { actorIpAddress, actorUserAgent } = extractRequestMeta(req);
  await disableMfa(req.user.id, actorIpAddress, actorUserAgent);
  res.json({ message: 'MFA disabled.' });
});

// POST /auth/mfa/backup-codes/regenerate
router.post('/mfa/backup-codes/regenerate', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const { actorIpAddress, actorUserAgent } = extractRequestMeta(req);
  const codes = await regenerateBackupCodes(req.user.id, actorIpAddress, actorUserAgent);
  res.json({ backupCodes: codes });
});

export default router;
