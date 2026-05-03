/**
 * Mutual Aid routes
 * Mounted at: /api/facilities/:facilityId/mutual-aid
 */

import { Router, Request, Response } from 'express';
import { requireAuth } from '../../middleware/auth.middleware';
import { requirePermission } from '../../middleware/rbac.middleware';
import {
  listMutualAidAgreements, getMutualAidAgreement,
  createMutualAidAgreement, updateMutualAidAgreement,
} from './mutualaid.service';

const router = Router({ mergeParams: true });

router.get('/',
  requireAuth,
  requirePermission('facility:read'),
  async (req: Request, res: Response) => {
    const agreements = await listMutualAidAgreements(req.params.facilityId);
    res.json(agreements);
  },
);

router.post('/',
  requireAuth,
  requirePermission('facility:edit'),
  async (req: Request, res: Response) => {
    const agreement = await createMutualAidAgreement({
      ...req.body,
      facilityId: req.params.facilityId,
      healthSystemId: req.user!.healthSystemId,
      createdBy: req.user!.id,
    });
    res.status(201).json(agreement);
  },
);

router.get('/:agreementId',
  requireAuth,
  requirePermission('facility:read'),
  async (req: Request, res: Response) => {
    const agreement = await getMutualAidAgreement(req.params.agreementId);
    res.json(agreement);
  },
);

router.patch('/:agreementId',
  requireAuth,
  requirePermission('facility:edit'),
  async (req: Request, res: Response) => {
    const updated = await updateMutualAidAgreement(req.params.agreementId, req.body);
    res.json(updated);
  },
);

export { router as mutualAidRouter };
