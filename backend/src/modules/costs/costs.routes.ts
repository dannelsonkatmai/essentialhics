/**
 * Cost Ledger routes
 * Mounted at: /api/facilities/:facilityId/incidents/:incidentId/costs
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { requireAuth } from '../../middleware/auth.middleware';
import { requirePermission } from '../../middleware/rbac.middleware';
import { validate } from '../../middleware/validate.middleware';
import {
  createCostRecord, listCostRecords, getCostRecord,
  approveCostRecord, softDeleteCostRecord,
  computeCostRollup, getLatestRollup,
} from './cost-calculation.service';
import { prisma } from '../../config/database';
import { enqueueFemaExport } from '../../jobs/femaExport.worker';
import { enqueuePeriodCostPdf } from '../../jobs/periodCostPdf.worker';

const router = Router({ mergeParams: true });

const laborSchema = z.object({
  userId: z.string().uuid().optional(),
  employeeId: z.string().optional(),
  position: z.string().optional(),
  regularHours: z.number().nonnegative(),
  overtimeHours: z.number().nonnegative().optional(),
  regularRate: z.number().nonnegative(),
  overtimeRate: z.number().nonnegative().optional(),
  benefits: z.number().nonnegative().optional(),
  periodStart: z.string().datetime().optional(),
  periodEnd: z.string().datetime().optional(),
}).optional();

const equipmentSchema = z.object({
  incidentResourceId: z.string().uuid().optional(),
  equipmentType: z.string().min(1),
  equipmentIdentifier: z.string().optional(),
  hours: z.number().nonnegative().optional(),
  dailyRate: z.number().nonnegative().optional(),
  mileage: z.number().nonnegative().optional(),
  mileageRate: z.number().nonnegative().optional(),
  operator: z.string().optional(),
}).optional();

const createCostSchema = z.object({
  operationalPeriodId: z.string().uuid().optional(),
  costType: z.enum(['LABOR', 'EQUIPMENT', 'SUPPLY', 'CONTRACT', 'OVERHEAD']),
  femaPACategory: z.enum(['CAT_A', 'CAT_B', 'CAT_C', 'CAT_D', 'CAT_E', 'CAT_F', 'CAT_G', 'CAT_Z']),
  description: z.string().min(1),
  quantity: z.number().positive().optional(),
  unitCost: z.number().nonnegative(),
  vendor: z.string().optional(),
  invoiceNumber: z.string().optional(),
  documentationUrl: z.string().url().optional(),
  incurredAt: z.string().datetime(),
  notes: z.string().optional(),
  labor: laborSchema,
  equipment: equipmentSchema,
});

// GET /costs
router.get('/',
  requireAuth,
  requirePermission('incident:read'),
  async (req: Request, res: Response) => {
    const { operationalPeriodId, costType, femaPACategory, isApproved } = req.query as Record<string, string>;
    const records = await listCostRecords(req.params.incidentId, {
      operationalPeriodId,
      costType: costType as any,
      femaPACategory: femaPACategory as any,
      isApproved: isApproved === 'true' ? true : isApproved === 'false' ? false : undefined,
    });
    res.json(records);
  },
);

// POST /costs
router.post('/',
  requireAuth,
  requirePermission('cost:edit'),
  validate(createCostSchema),
  async (req: Request, res: Response) => {
    const record = await createCostRecord({
      ...req.body,
      incidentId: req.params.incidentId,
      recordedByUserId: req.user!.id,
    });
    res.status(201).json(record);
  },
);

// GET /costs/rollup
router.get('/rollup',
  requireAuth,
  requirePermission('incident:read'),
  async (req: Request, res: Response) => {
    const { operationalPeriodId } = req.query as { operationalPeriodId?: string };
    const rollup = await getLatestRollup(req.params.incidentId, operationalPeriodId);
    if (!rollup) return res.status(404).json({ error: 'No rollup available yet' });
    res.json(rollup);
  },
);

// POST /costs/rollup/compute (on-demand refresh)
router.post('/rollup/compute',
  requireAuth,
  requirePermission('cost:edit'),
  async (req: Request, res: Response) => {
    await computeCostRollup(req.params.incidentId);
    const rollup = await getLatestRollup(req.params.incidentId);
    res.json(rollup);
  },
);

// GET /costs/:costId
router.get('/:costId',
  requireAuth,
  requirePermission('incident:read'),
  async (req: Request, res: Response) => {
    const record = await getCostRecord(req.params.costId);
    res.json(record);
  },
);

// POST /costs/:costId/approve
router.post('/:costId/approve',
  requireAuth,
  requirePermission('cost:approve'),
  async (req: Request, res: Response) => {
    const updated = await approveCostRecord(req.params.costId, req.user!.id);
    res.json(updated);
  },
);

// DELETE /costs/:costId
router.delete('/:costId',
  requireAuth,
  requirePermission('cost:edit'),
  async (req: Request, res: Response) => {
    await softDeleteCostRecord(req.params.costId, req.user!.id);
    res.json({ message: 'Cost record deleted' });
  },
);

// POST /costs/export/fema-pa (queue FEMA PA XLSX export)
router.post('/export/fema-pa',
  requireAuth,
  requirePermission('report:export'),
  async (req: Request, res: Response) => {
    const { approvedOnly, operationalPeriodId } = req.body as {
      approvedOnly?: boolean;
      operationalPeriodId?: string;
    };

    const exportJob = await prisma.exportJob.create({
      data: {
        jobType: 'FEMA_PA_XLSX',
        incidentId: req.params.incidentId,
        requestedBy: req.user!.id,
        status: 'PENDING',
      },
    });

    await enqueueFemaExport({
      exportJobId: exportJob.id,
      incidentId: req.params.incidentId,
      requestedByUserId: req.user!.id,
      approvedOnly,
      operationalPeriodId,
    });

    res.status(202).json({ exportJobId: exportJob.id, status: 'PENDING' });
  },
);

// POST /costs/export/period-pdf (queue period cost PDF)
router.post('/export/period-pdf',
  requireAuth,
  requirePermission('report:export'),
  async (req: Request, res: Response) => {
    const { operationalPeriodId } = req.body as { operationalPeriodId: string };
    if (!operationalPeriodId) {
      return res.status(422).json({ error: 'operationalPeriodId is required' });
    }

    const exportJob = await prisma.exportJob.create({
      data: {
        jobType: 'COST_SUMMARY_PDF',
        incidentId: req.params.incidentId,
        requestedBy: req.user!.id,
        status: 'PENDING',
      },
    });

    await enqueuePeriodCostPdf({
      exportJobId: exportJob.id,
      incidentId: req.params.incidentId,
      operationalPeriodId,
      requestedByUserId: req.user!.id,
    });

    res.status(202).json({ exportJobId: exportJob.id, status: 'PENDING' });
  },
);

// GET /costs/export/:exportJobId (poll job status)
router.get('/export/:exportJobId',
  requireAuth,
  requirePermission('incident:read'),
  async (req: Request, res: Response) => {
    const job = await prisma.exportJob.findUnique({ where: { id: req.params.exportJobId } });
    if (!job) return res.status(404).json({ error: 'Export job not found' });
    res.json(job);
  },
);

export { router as costsRouter };
