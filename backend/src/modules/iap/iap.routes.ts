import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../../middleware/auth.middleware';
import { requirePermission } from '../../middleware/rbac.middleware';
import { validate } from '../../middleware/validate.middleware';
import type { AuthenticatedRequest } from '../../types';
import * as svc from './iap.service';
import * as workflow from './iap.workflow';
import { enqueuePdfExport } from '../../jobs/queue';
import { prisma } from '../../config/database';

const router = Router({ mergeParams: true });
router.use(requireAuth);

// ── IAP ─────────────────────────────────────────────────────────────────────

router.get('/:iapId', requirePermission('iap:read'), async (req: AuthenticatedRequest, res) => {
  const iap = await svc.getIap(req.params.iapId!);
  res.json(iap);
});

// ── Workflow transitions ─────────────────────────────────────────────────────

router.post('/:iapId/submit', requirePermission('iap:edit'), async (req: AuthenticatedRequest, res) => {
  await workflow.submitForReview(req.params.iapId!, req.user);
  res.json({ message: 'IAP submitted for review.' });
});

router.post('/:iapId/approve', requirePermission('iap:approve'), async (req: AuthenticatedRequest, res) => {
  await workflow.approveIap(req.params.iapId!, req.user);
  res.json({ message: 'IAP approved.' });
});

const returnSchema = z.object({ body: z.object({ notes: z.string().min(10).max(2000) }) });
router.post(
  '/:iapId/return',
  requirePermission('iap:approve'),
  validate(returnSchema),
  async (req: AuthenticatedRequest, res) => {
    await workflow.returnToDraft(req.params.iapId!, req.body.notes, req.user);
    res.json({ message: 'IAP returned to draft.' });
  },
);

const publishSchema = z.object({ body: z.object({ signatureData: z.string().min(10) }) });
router.post(
  '/:iapId/publish',
  requirePermission('iap:publish'),
  validate(publishSchema),
  async (req: AuthenticatedRequest, res) => {
    await workflow.publishIap(req.params.iapId!, req.body.signatureData, req.user);
    res.json({ message: 'IAP published.' });
  },
);

router.post('/:iapId/archive', requirePermission('iap:approve'), async (req: AuthenticatedRequest, res) => {
  await workflow.archiveIap(req.params.iapId!, req.user);
  res.json({ message: 'IAP archived.' });
});

// ── Form auto-save (PATCH) ───────────────────────────────────────────────────

const formSaveSchema = z.object({
  body: z.object({
    formData: z.record(z.unknown()),
  }),
});

// Generic single forms: 201, 202, 203, 207, 215, 215a, hics251, hics252
router.patch(
  '/:iapId/forms/:formNumber',
  requirePermission('iap:edit'),
  validate(formSaveSchema),
  async (req: AuthenticatedRequest, res) => {
    const { iapId, formNumber } = req.params as { iapId: string; formNumber: string };
    const result = await svc.saveForm(iapId, formNumber, req.body.formData, req.user);
    res.json(result);
  },
);

// ICS-204: multiple per period — POST to create, PATCH to update by ID
const form204Schema = z.object({
  body: z.object({
    branchName: z.string().min(1).max(200),
    divisionGroupName: z.string().min(1).max(200),
    formData: z.record(z.unknown()),
  }),
});

router.post(
  '/:iapId/forms/204',
  requirePermission('iap:edit'),
  validate(form204Schema),
  async (req: AuthenticatedRequest, res) => {
    const result = await svc.saveForm204(
      req.params.iapId!,
      req.body.branchName,
      req.body.divisionGroupName,
      req.body.formData,
      req.user,
    );
    res.status(201).json(result);
  },
);

router.patch(
  '/:iapId/forms/204/:form204Id',
  requirePermission('iap:edit'),
  validate(form204Schema),
  async (req: AuthenticatedRequest, res) => {
    const result = await svc.saveForm204(
      req.params.iapId!,
      req.body.branchName,
      req.body.divisionGroupName,
      req.body.formData,
      req.user,
      req.params.form204Id,
    );
    res.json(result);
  },
);

// ── ICS-213 General Message Log (incident-scoped) ───────────────────────────

router.get('/incidents/:incidentId/forms/213', requirePermission('iap:read'), async (req: AuthenticatedRequest, res) => {
  const page = Number(req.query.page) || 1;
  const limit = Math.min(Number(req.query.limit) || 50, 200);
  const result = await svc.listForm213(req.params.incidentId!, page, limit);
  res.json(result);
});

router.post(
  '/incidents/:incidentId/forms/213',
  requirePermission('iap:edit'),
  validate(z.object({ body: z.object({ formData: z.record(z.unknown()) }) })),
  async (req: AuthenticatedRequest, res) => {
    const form = await svc.createForm213(req.params.incidentId!, req.body.formData, req.user);
    res.status(201).json(form);
  },
);

// ── Review assignments ───────────────────────────────────────────────────────

router.post(
  '/:iapId/reviewers',
  requirePermission('iap:approve'),
  validate(z.object({ body: z.object({ reviewerUserId: z.string().uuid() }) })),
  async (req: AuthenticatedRequest, res) => {
    const assignment = await svc.assignReviewer(req.params.iapId!, req.body.reviewerUserId, req.user);
    res.status(201).json(assignment);
  },
);

// ── Comments ─────────────────────────────────────────────────────────────────

router.post(
  '/:iapId/comments',
  requirePermission('iap:read'),
  validate(z.object({
    body: z.object({
      body: z.string().min(1).max(5000),
      formReference: z.string().optional().nullable(),
      parentId: z.string().uuid().optional().nullable(),
    }),
  })),
  async (req: AuthenticatedRequest, res) => {
    const comment = await svc.addComment(
      req.params.iapId!,
      req.body.body,
      req.body.formReference ?? null,
      req.body.parentId ?? null,
      req.user,
    );
    res.status(201).json(comment);
  },
);

router.post(
  '/:iapId/comments/:commentId/resolve',
  requirePermission('iap:approve'),
  async (req: AuthenticatedRequest, res) => {
    const comment = await svc.resolveComment(req.params.commentId!, req.user);
    res.json(comment);
  },
);

// ── PDF Export ───────────────────────────────────────────────────────────────

router.post(
  '/:iapId/export',
  requirePermission('iap:read'),
  async (req: AuthenticatedRequest, res) => {
    const iapId = req.params.iapId!;
    const formNumbers: string[] | undefined = req.body.formNumbers;

    // Create export job record
    const exportJob = await prisma.exportJob.create({
      data: {
        iapId,
        status: 'PENDING',
        requestedById: req.user.id,
        formNumbers: formNumbers ?? [],
      },
    });

    await enqueuePdfExport({
      exportJobId: exportJob.id,
      iapId,
      requestedByUserId: req.user.id,
      formNumbers,
    });

    res.status(202).json({ exportJobId: exportJob.id, status: 'PENDING' });
  },
);

router.get(
  '/:iapId/export/:exportJobId',
  requirePermission('iap:read'),
  async (req: AuthenticatedRequest, res) => {
    const job = await prisma.exportJob.findUniqueOrThrow({ where: { id: req.params.exportJobId! } });
    res.json(job);
  },
);

export default router;
