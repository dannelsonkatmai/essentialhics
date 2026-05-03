import { authenticator } from 'otplib';
import QRCode from 'qrcode';
import crypto from 'crypto';
import { prisma } from '../config/database';
import { encrypt, decrypt, encryptArray, decryptArray } from '../utils/encryption';
import { writeAuditLog } from '../utils/audit';

authenticator.options = { window: 1 }; // Allow 1 step drift

const BACKUP_CODE_COUNT = 8;

export interface MfaEnrollResult {
  secret: string;
  qrCodeDataUrl: string;
  backupCodes: string[];
}

export async function enrollMfa(
  userId: string,
  userEmail: string,
  ipAddress: string,
  userAgent: string,
): Promise<MfaEnrollResult> {
  const secret = authenticator.generateSecret();
  const otpAuthUrl = authenticator.keyuri(userEmail, 'Essential HICS', secret);
  const qrCodeDataUrl = await QRCode.toDataURL(otpAuthUrl);

  // Generate 8 single-use backup codes
  const backupCodes = Array.from({ length: BACKUP_CODE_COUNT }, () =>
    crypto.randomBytes(5).toString('hex').toUpperCase().match(/.{1,5}/g)!.join('-'),
  );

  const encryptedSecret = encrypt(secret);
  const encryptedBackupCodes = encryptArray(backupCodes);

  await prisma.user.update({
    where: { id: userId },
    data: {
      mfaSecret: encryptedSecret,
      mfaBackupCodes: encryptedBackupCodes,
      mfaEnabled: true,
    },
  });

  await writeAuditLog({
    actorUserId: userId,
    actorIpAddress: ipAddress,
    actorUserAgent: userAgent,
    action: 'USER_MFA_ENROLLED',
    resourceType: 'User',
    resourceId: userId,
  });

  return { secret, qrCodeDataUrl, backupCodes };
}

export async function verifyTotp(userId: string, code: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { mfaSecret: true, mfaEnabled: true },
  });

  if (!user?.mfaEnabled || !user.mfaSecret) return false;

  const secret = decrypt(user.mfaSecret);
  return authenticator.check(code, secret);
}

export async function verifyBackupCode(userId: string, code: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { mfaBackupCodes: true },
  });

  if (!user?.mfaBackupCodes?.length) return false;

  const decrypted = decryptArray(user.mfaBackupCodes);
  const normalised = code.toUpperCase().replace(/\s/g, '');
  const idx = decrypted.findIndex((c) => c.replace(/-/g, '') === normalised.replace(/-/g, ''));

  if (idx === -1) return false;

  // Remove used backup code (single-use)
  const remaining = user.mfaBackupCodes.filter((_, i) => i !== idx);
  await prisma.user.update({
    where: { id: userId },
    data: { mfaBackupCodes: remaining },
  });

  return true;
}

export async function disableMfa(
  userId: string,
  ipAddress: string,
  userAgent: string,
): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: { mfaEnabled: false, mfaSecret: null, mfaBackupCodes: [] },
  });

  await writeAuditLog({
    actorUserId: userId,
    actorIpAddress: ipAddress,
    actorUserAgent: userAgent,
    action: 'USER_MFA_DISABLED',
    resourceType: 'User',
    resourceId: userId,
  });
}

export async function regenerateBackupCodes(
  userId: string,
  ipAddress: string,
  userAgent: string,
): Promise<string[]> {
  const backupCodes = Array.from({ length: BACKUP_CODE_COUNT }, () =>
    crypto.randomBytes(5).toString('hex').toUpperCase().match(/.{1,5}/g)!.join('-'),
  );

  await prisma.user.update({
    where: { id: userId },
    data: { mfaBackupCodes: encryptArray(backupCodes) },
  });

  await writeAuditLog({
    actorUserId: userId,
    actorIpAddress: ipAddress,
    actorUserAgent: userAgent,
    action: 'USER_MFA_ENROLLED',
    resourceType: 'User',
    resourceId: userId,
    metadata: { type: 'backup_codes_regenerated' },
  });

  return backupCodes;
}
