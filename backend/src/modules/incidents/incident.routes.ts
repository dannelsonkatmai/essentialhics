import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../../middleware/auth.middleware';
import { requirePermission } from '../../middleware/rbac.middleware';
import { validate } from '../../middleware/validate.middleware';
import type { AuthenticatedRequest } from '../../types';
import * as svc from './incident.service';
import { IncidentType, IncidentSeverity } from '@prisma/client';

const router = Router({ mergeParams: true });

// All routes require authentication
router.use(requireAuth);

// ── Incidents ───────────────────────────────────────────────────────────────

const createIncidentSchema = z.object({
  body: z.object({
    name: z.string().min(3).max(200),
    incidentType: z.nativeEnum(IncidentType),
    severity: z.nativeEnum(IncidentSeverity),
    declarationTime: z.coerce.date(),
    location: z.string().max(500).optional(),
    description: z.string().max(5000).optional(),
    isExercise: z.boolean().default(false),
    incidentCommanderId: z.string().uuid().optional(),
  }),
});

const updateIncidentSchema = z.object({
  body: z.object({
    name: z.string().min(3).max(200).optional(),
    severity: z.nativeEnum(IncidentSeverity).optional(),
    description: z.string().max(5000).optional(),
    location: z.string().max(500).optional(),
    incidentCommanderId: z.string().uuid().optional(),
  }),
});

router.get(
  '/',
  requirePermission('incident:read'),
  async (req: AuthenticatedRequest, res) => {
    const facilityId = req.params.facilityId!;
    const page = Number(req.query.page) || 1;
    const limit = Math.min(Number(req.query.limit) || 20, 100);
    const status = req.query.status as any;
    const result = await svc.listIncidents(req.user, facilityId, { status, page, limit });
    res.json(result);
  },
);

router.post(
  '/',
  requirePermission('incident:create'),
  validate(createIncidentSchema),
  async (req: AuthenticatedRequest, res) => {
    const facilityId = req.params.facilityId!;
    const incident = await svc.createIncident({ ...req.body, facilityId }, req.user);
    res.status(201).json(incident);
  },
);

router.get(
  '/:incidentId',
  requirePermission('incident:read'),
  async (req: AuthenticatedRequest, res) => {
    const incident = await svc.getIncident(req.params.incidentId!, req.params.facilityId!);
    if (!incident) return res.status(404).json({ message: 'Incident not found.' });
    res.json(incident);
  },
);

router.patch(
  '/:incidentId',
  requirePermission('incident:create'),
  validate(updateIncidentSchema),
  async (req: AuthenticatedRequest, res) => {
    const updated = await svc.updateIncident(
      req.params.incidentId!,
      req.params.facilityId!,
      req.body,
      req.user,
    );
    res.json(updated);
  },
);

router.post(
  '/:incidentId/close',
  requirePermission('incident:close'),
  async (req: AuthenticatedRequest, res) => {
    const updated = await svc.closeIncident(req.params.incidentId!, req.params.facilityId!, req.user);
    res.json(updated);
  },
);

// ── Operational Periods ─────────────────────────────────────────────────────

const createPeriodSchema = z.object({
  body: z.object({
    startTime: z.coerce.date(),
    endTime: z.coerce.date(),
    objectives: z.string().max(5000).optional(),
  }),
});

router.get(
  '/:incidentId/periods',
  requirePermission('incident:read'),
  async (req: AuthenticatedRequest, res) => {
    const periods = await svc.listOperationalPeriods(req.params.incidentId!, req.params.facilityId!);
    res.json(periods);
  },
);

router.post(
  '/:incidentId/periods',
  requirePermission('iap:create'),
  validate(createPeriodSchema),
  async (req: AuthenticatedRequest, res) => {
    const period = await svc.createOperationalPeriod(
      req.params.incidentId!,
      req.params.facilityId!,
      req.body,
      req.user,
    );
    res.status(201).json(period);
  },
);

router.post(
  '/:incidentId/periods/:periodId/activate',
  requirePermission('incident:create'),
  async (req: AuthenticatedRequest, res) => {
    const period = await svc.activateOperationalPeriod(
      req.params.incidentId!,
      req.params.periodId!,
      req.params.facilityId!,
      req.user,
    );
    res.json(period);
  },
);

export default router;
