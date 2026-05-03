import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../../middleware/auth.middleware';
import { requirePermission } from '../../middleware/rbac.middleware';
import { validate } from '../../middleware/validate.middleware';
import type { AuthenticatedRequest } from '../../types';
import * as svc from './template.service';

const router = Router();
router.use(requireAuth);

const formDefaultSchema = z.object({
  formNumber: z.string().min(1),
  defaults: z.record(z.unknown()),
});

const createTemplateSchema = z.object({
  body: z.object({
    name: z.string().min(2).max(200),
    description: z.string().max(2000).optional(),
    facilityId: z.string().uuid().optional(),
    parentTemplateId: z.string().uuid().optional(),
    formDefaults: z.array(formDefaultSchema).optional(),
  }),
});

// ── Template CRUD ─────────────────────────────────────────────────────────────

router.get('/', requirePermission('iap:read'), async (req: AuthenticatedRequest, res) => {
  const facilityId = req.query.facilityId as string | undefined;
  const templates = await svc.listTemplates(facilityId ?? null, req.user.healthSystemId);
  res.json(templates);
});

router.post('/', requirePermission('iap:create'), validate(createTemplateSchema), async (req: AuthenticatedRequest, res) => {
  const template = await svc.createTemplate(req.body, req.user);
  res.status(201).json(template);
});

router.get('/:id', requirePermission('iap:read'), async (req: AuthenticatedRequest, res) => {
  const template = await svc.getTemplate(req.params.id!);
  res.json(template);
});

router.put(
  '/:id',
  requirePermission('iap:create'),
  validate(createTemplateSchema),
  async (req: AuthenticatedRequest, res) => {
    const template = await svc.updateTemplate(req.params.id!, req.body, req.user);
    res.json(template);
  },
);

router.delete('/:id', requirePermission('iap:create'), async (req: AuthenticatedRequest, res) => {
  await svc.deleteTemplate(req.params.id!);
  res.status(204).send();
});

router.post(
  '/:id/duplicate',
  requirePermission('iap:create'),
  validate(z.object({ body: z.object({ name: z.string().min(2).max(200) }) })),
  async (req: AuthenticatedRequest, res) => {
    const copy = await svc.duplicateTemplate(req.params.id!, req.body.name, req.user);
    res.status(201).json(copy);
  },
);

router.get('/:id/resolve', requirePermission('iap:read'), async (req: AuthenticatedRequest, res) => {
  const defaults = await svc.resolveTemplateDefaults(req.params.id!);
  res.json(defaults);
});

// ── Objectives Bank ───────────────────────────────────────────────────────────

router.get('/objectives', requirePermission('iap:read'), async (req: AuthenticatedRequest, res) => {
  const facilityId = req.query.facilityId as string | undefined;
  const objectives = await svc.listObjectives(req.user.healthSystemId, facilityId);
  res.json(objectives);
});

router.post(
  '/objectives',
  requirePermission('iap:create'),
  validate(z.object({
    body: z.object({
      objectiveText: z.string().min(5).max(2000),
      priority: z.enum(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']),
      tags: z.array(z.string()).optional(),
      facilityId: z.string().uuid().optional(),
    }),
  })),
  async (req: AuthenticatedRequest, res) => {
    const obj = await svc.createObjective(req.body, req.user);
    res.status(201).json(obj);
  },
);

router.post('/objectives/:id/use', requirePermission('iap:read'), async (req: AuthenticatedRequest, res) => {
  await svc.incrementObjectiveUsage(req.params.id!);
  res.json({ ok: true });
});

// ── Tactics Bank ──────────────────────────────────────────────────────────────

router.get('/tactics', requirePermission('iap:read'), async (req: AuthenticatedRequest, res) => {
  const facilityId = req.query.facilityId as string | undefined;
  const tactics = await svc.listTactics(req.user.healthSystemId, facilityId);
  res.json(tactics);
});

router.post(
  '/tactics',
  requirePermission('iap:create'),
  validate(z.object({
    body: z.object({
      tacticText: z.string().min(5).max(2000),
      tags: z.array(z.string()).optional(),
      facilityId: z.string().uuid().optional(),
    }),
  })),
  async (req: AuthenticatedRequest, res) => {
    const tactic = await svc.createTactic(req.body, req.user);
    res.status(201).json(tactic);
  },
);

router.post('/tactics/:id/use', requirePermission('iap:read'), async (req: AuthenticatedRequest, res) => {
  await svc.incrementTacticUsage(req.params.id!);
  res.json({ ok: true });
});

export default router;
