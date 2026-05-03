import { Router, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../config/database';
import { requireAuth } from '../middleware/auth.middleware';
import { requirePermission } from '../middleware/rbac.middleware';
import { validate } from '../middleware/validate.middleware';
import { writeAuditLog, diffObjects, extractRequestMeta } from '../utils/audit';
import type { AuthenticatedRequest } from '../types';

const router = Router();

const updateSettingsSchema = z.object({
  mfaPolicy: z.enum(['REQUIRED', 'ADMIN_REQUIRED', 'OPTIONAL']).optional(),
  maxConcurrentSessions: z.number().min(1).max(10).optional(),
  passwordExpiryDays: z.number().min(30).max(365).optional(),
  sessionTimeoutMinutes: z.number().min(15).max(1440).optional(),
  ssoConfig: z.record(z.unknown()).optional(),
}).strict();

// GET /api/health-system/settings
router.get(
  '/settings',
  requireAuth,
  requirePermission('facility:read', { scopeFacility: false }),
  async (req: AuthenticatedRequest, res: Response) => {
    const hs = await prisma.healthSystem.findFirst({ where: { isDeleted: false } });
    if (!hs) { res.status(404).json({ message: 'Health system not found.' }); return; }
    res.json({ id: hs.id, name: hs.name, shortName: hs.shortName, settings: hs.settings });
  },
);

// PUT /api/health-system/settings
router.put(
  '/settings',
  requireAuth,
  requirePermission('facility:edit', { scopeFacility: false }),
  validate(updateSettingsSchema),
  async (req: AuthenticatedRequest, res: Response) => {
    const { actorIpAddress, actorUserAgent } = extractRequestMeta(req);

    const hs = await prisma.healthSystem.findFirst({ where: { isDeleted: false } });
    if (!hs) { res.status(404).json({ message: 'Health system not found.' }); return; }

    const oldSettings = hs.settings as Record<string, unknown>;
    const newSettings = { ...oldSettings, ...req.body };

    const updated = await prisma.healthSystem.update({
      where: { id: hs.id },
      data: { settings: newSettings },
    });

    await writeAuditLog({
      actorUserId: req.user.id,
      actorIpAddress,
      actorUserAgent,
      action: 'SETTINGS_UPDATED',
      resourceType: 'HealthSystem',
      resourceId: hs.id,
      changes: diffObjects(
        { settings: oldSettings },
        { settings: newSettings },
      ),
    });

    res.json({ settings: updated.settings });
  },
);

export default router;
