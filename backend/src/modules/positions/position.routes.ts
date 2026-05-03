import { Router } from 'express';
import { z } from 'zod';
import { HicsRole } from '@prisma/client';
import { requireAuth } from '../../middleware/auth.middleware';
import { requirePermission } from '../../middleware/rbac.middleware';
import { validate } from '../../middleware/validate.middleware';
import type { AuthenticatedRequest } from '../../types';
import * as svc from './position.service';

// Mounted at /api/facilities/:facilityId/incidents/:incidentId/positions
const router = Router({ mergeParams: true });
router.use(requireAuth);

router.get('/', requirePermission('incident:read'), async (req: AuthenticatedRequest, res) => {
  const assignments = await svc.getOrgBoard(req.params.incidentId!);
  res.json(assignments);
});

const assignSchema = z.object({
  body: z.object({
    hicsRole: z.nativeEnum(HicsRole),
    userId: z.string().uuid(),
  }),
});

router.post(
  '/',
  requirePermission('incident:create'),
  validate(assignSchema),
  async (req: AuthenticatedRequest, res) => {
    const assignment = await svc.assignPosition(
      req.params.incidentId!,
      req.body.hicsRole,
      req.body.userId,
      req.params.facilityId!,
      req.user,
    );
    res.status(201).json(assignment);
  },
);

router.delete(
  '/:assignmentId',
  requirePermission('incident:create'),
  async (req: AuthenticatedRequest, res) => {
    await svc.relievePosition(
      req.params.assignmentId!,
      req.params.incidentId!,
      req.params.facilityId!,
      req.user,
    );
    res.status(204).send();
  },
);

router.delete(
  '/roles/:hicsRole',
  requirePermission('incident:create'),
  async (req: AuthenticatedRequest, res) => {
    await svc.vacatePosition(
      req.params.incidentId!,
      req.params.hicsRole as HicsRole,
      req.params.facilityId!,
      req.user,
    );
    res.status(204).send();
  },
);

router.post(
  '/sync-203',
  requirePermission('iap:edit'),
  validate(z.object({ body: z.object({ iapId: z.string().uuid() }) })),
  async (req: AuthenticatedRequest, res) => {
    const formData = await svc.syncToForm203(
      req.body.iapId,
      req.params.incidentId!,
      req.user,
    );
    res.json({ formData });
  },
);

export default router;
