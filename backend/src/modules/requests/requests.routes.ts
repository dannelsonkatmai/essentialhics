/**
 * Resource Request (ICS-213RR) routes
 * Mounted at: /api/facilities/:facilityId/incidents/:incidentId/requests
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { requireAuth } from '../../middleware/auth.middleware';
import { requirePermission } from '../../middleware/rbac.middleware';
import { validate } from '../../middleware/validate.middleware';
import {
  listRequests, getRequest, createRequest,
  submitRequest, approveRequest, denyRequest, cancelRequest,
  fulfillLineItem,
} from './request-workflow.service';

const router = Router({ mergeParams: true });

const lineItemSchema = z.object({
  resourceTypeId: z.string().uuid().optional(),
  resourceDescription: z.string().min(1),
  quantity: z.number().positive(),
  unit: z.string().optional(),
  estimatedUnitCost: z.number().nonnegative().optional(),
  notes: z.string().optional(),
});

const createRequestSchema = z.object({
  priority: z.enum(['IMMEDIATE', 'PRIORITY', 'ROUTINE']).optional(),
  missionAssignment: z.string().optional(),
  requestedForRole: z.string().optional(),
  requestedForSection: z.string().optional(),
  deliveryLocation: z.string().optional(),
  deliveryBy: z.string().datetime().optional(),
  neededDate: z.string().datetime().optional(),
  justification: z.string().optional(),
  lineItems: z.array(lineItemSchema).min(0),
});

// GET /requests
router.get('/',
  requireAuth,
  requirePermission('incident:read'),
  async (req: Request, res: Response) => {
    const { status } = req.query as Record<string, string>;
    const requests = await listRequests(req.params.incidentId, { status: status as any });
    res.json(requests);
  },
);

// POST /requests
router.post('/',
  requireAuth,
  requirePermission('resource:request'),
  validate(createRequestSchema),
  async (req: Request, res: Response) => {
    const request = await createRequest({
      ...req.body,
      incidentId: req.params.incidentId,
      facilityId: req.params.facilityId,
      requestedByUserId: req.user!.id,
    });
    res.status(201).json(request);
  },
);

// GET /requests/:requestId
router.get('/:requestId',
  requireAuth,
  requirePermission('incident:read'),
  async (req: Request, res: Response) => {
    const request = await getRequest(req.params.requestId);
    res.json(request);
  },
);

// POST /requests/:requestId/submit
router.post('/:requestId/submit',
  requireAuth,
  requirePermission('resource:request'),
  async (req: Request, res: Response) => {
    const updated = await submitRequest(req.params.requestId, req.user!.id);
    res.json(updated);
  },
);

// POST /requests/:requestId/approve
router.post('/:requestId/approve',
  requireAuth,
  requirePermission('resource:approve'),
  async (req: Request, res: Response) => {
    const updated = await approveRequest(
      req.params.requestId,
      req.user!.id,
      req.body.approvalNotes,
    );
    res.json(updated);
  },
);

// POST /requests/:requestId/deny
router.post('/:requestId/deny',
  requireAuth,
  requirePermission('resource:approve'),
  async (req: Request, res: Response) => {
    const updated = await denyRequest(
      req.params.requestId,
      req.user!.id,
      req.body.denialReason,
    );
    res.json(updated);
  },
);

// POST /requests/:requestId/cancel
router.post('/:requestId/cancel',
  requireAuth,
  requirePermission('resource:request'),
  async (req: Request, res: Response) => {
    const updated = await cancelRequest(req.params.requestId, req.user!.id);
    res.json(updated);
  },
);

// POST /requests/:requestId/line-items/:lineItemId/fulfill
router.post('/:requestId/line-items/:lineItemId/fulfill',
  requireAuth,
  requirePermission('resource:request'),
  async (req: Request, res: Response) => {
    const { incidentResourceId, quantityFulfilled, notes } = req.body as {
      incidentResourceId: string;
      quantityFulfilled: number;
      notes?: string;
    };
    const fulfillment = await fulfillLineItem({
      lineItemId: req.params.lineItemId,
      incidentResourceId,
      quantityFulfilled,
      fulfilledByUserId: req.user!.id,
      notes,
    });
    res.status(201).json(fulfillment);
  },
);

export { router as requestsRouter };
