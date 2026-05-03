/**
 * Resource routes — catalog, incident resources, status transitions, assignments
 * Mounted at: /api/facilities/:facilityId/incidents/:incidentId/resources
 *             /api/facilities/:facilityId/resource-catalog
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { requireAuth } from '../../middleware/auth.middleware';
import { requirePermission } from '../../middleware/rbac.middleware';
import { validate } from '../../middleware/validate.middleware';
import {
  listIncidentResources, getIncidentResource, createIncidentResource,
  updateIncidentResource, softDeleteIncidentResource, demobilizeResource,
  getResourceSummary,
} from './incident-resources.service';
import {
  listResourceTypes, getResourceType, createResourceType,
  updateResourceType, softDeleteResourceType,
  getFacilityInventory, upsertInventoryItem,
} from './resource-catalog.service';
import {
  transitionResourceStatus, bulkCheckIn, getResourceStatusHistory,
} from './resource-status.service';

const router = Router({ mergeParams: true });

// ─── Incident resources ───────────────────────────────────────────────────────

const createResourceSchema = z.object({
  resourceTypeId: z.string().uuid().optional(),
  name: z.string().min(1),
  nimsKind: z.enum(['PERSONNEL', 'EQUIPMENT', 'TEAM', 'SUPPLY', 'FACILITIES', 'OTHER']),
  quantity: z.number().positive().optional(),
  unit: z.string().optional(),
  source: z.enum(['INTERNAL', 'MUTUAL_AID', 'CONTRACTED', 'DONATED']).optional(),
  resourceIdentifier: z.string().optional(),
  homeBaseOrgName: z.string().optional(),
  homeBaseContact: z.string().optional(),
  requestId: z.string().uuid().optional(),
  eta: z.string().datetime().optional(),
  assignedToRole: z.string().optional(),
  assignedToLocation: z.string().optional(),
  costPerUnit: z.number().nonnegative().optional(),
  costUnitPeriod: z.enum(['HOURLY', 'DAILY', 'WEEKLY', 'FLAT']).optional(),
  notes: z.string().optional(),
});

const transitionSchema = z.object({
  toStatus: z.enum(['ORDERED', 'IN_TRANSIT', 'ASSIGNED', 'AVAILABLE', 'OUT_OF_SERVICE', 'DEMOBILIZED']),
  location: z.string().optional(),
  notes: z.string().optional(),
  assignedToRole: z.string().optional(),
  assignedToLocation: z.string().optional(),
});

// GET /incidents/:incidentId/resources
router.get('/',
  requireAuth,
  requirePermission('incident:read'),
  async (req: Request, res: Response) => {
    const { incidentId } = req.params;
    const { status, nimsKind, source } = req.query as Record<string, string>;
    const resources = await listIncidentResources(incidentId, { status: status as any, nimsKind: nimsKind as any, source: source as any });
    res.json(resources);
  },
);

// GET /incidents/:incidentId/resources/summary
router.get('/summary',
  requireAuth,
  requirePermission('incident:read'),
  async (req: Request, res: Response) => {
    const summary = await getResourceSummary(req.params.incidentId);
    res.json(summary);
  },
);

// POST /incidents/:incidentId/resources
router.post('/',
  requireAuth,
  requirePermission('resource:request'),
  validate(createResourceSchema),
  async (req: Request, res: Response) => {
    const resource = await createIncidentResource({
      ...req.body,
      incidentId: req.params.incidentId,
      facilityId: req.params.facilityId,
      createdBy: req.user!.id,
    });
    res.status(201).json(resource);
  },
);

// GET /incidents/:incidentId/resources/:resourceId
router.get('/:resourceId',
  requireAuth,
  requirePermission('incident:read'),
  async (req: Request, res: Response) => {
    const resource = await getIncidentResource(req.params.resourceId);
    res.json(resource);
  },
);

// PATCH /incidents/:incidentId/resources/:resourceId
router.patch('/:resourceId',
  requireAuth,
  requirePermission('resource:request'),
  async (req: Request, res: Response) => {
    const updated = await updateIncidentResource(req.params.resourceId, req.body, req.user!.id);
    res.json(updated);
  },
);

// DELETE /incidents/:incidentId/resources/:resourceId
router.delete('/:resourceId',
  requireAuth,
  requirePermission('resource:request'),
  async (req: Request, res: Response) => {
    await softDeleteIncidentResource(req.params.resourceId, req.user!.id);
    res.json({ message: 'Resource deleted' });
  },
);

// POST /incidents/:incidentId/resources/:resourceId/transition
router.post('/:resourceId/transition',
  requireAuth,
  requirePermission('resource:request'),
  validate(transitionSchema),
  async (req: Request, res: Response) => {
    const updated = await transitionResourceStatus({
      incidentResourceId: req.params.resourceId,
      toStatus: req.body.toStatus,
      changedByUserId: req.user!.id,
      location: req.body.location,
      notes: req.body.notes,
      assignedToRole: req.body.assignedToRole,
      assignedToLocation: req.body.assignedToLocation,
    });
    res.json(updated);
  },
);

// POST /incidents/:incidentId/resources/:resourceId/demobilize
router.post('/:resourceId/demobilize',
  requireAuth,
  requirePermission('resource:request'),
  async (req: Request, res: Response) => {
    const updated = await demobilizeResource(req.params.resourceId, req.user!.id, req.body.notes);
    res.json(updated);
  },
);

// POST /incidents/:incidentId/resources/bulk-checkin
router.post('/bulk-checkin',
  requireAuth,
  requirePermission('resource:request'),
  async (req: Request, res: Response) => {
    const { resourceIds, location } = req.body as { resourceIds: string[]; location?: string };
    const result = await bulkCheckIn(resourceIds, req.user!.id, location);
    res.json(result);
  },
);

// GET /incidents/:incidentId/resources/:resourceId/history
router.get('/:resourceId/history',
  requireAuth,
  requirePermission('incident:read'),
  async (req: Request, res: Response) => {
    const history = await getResourceStatusHistory(req.params.resourceId);
    res.json(history);
  },
);

// ─── Resource Catalog ─────────────────────────────────────────────────────────

const catalogRouter = Router({ mergeParams: true });

const createTypeSchema = z.object({
  nimsKind: z.enum(['PERSONNEL', 'EQUIPMENT', 'TEAM', 'SUPPLY', 'FACILITIES', 'OTHER']),
  name: z.string().min(1),
  description: z.string().optional(),
  unit: z.string().min(1),
  category: z.enum(['OVERHEAD', 'LABOR', 'EQUIPMENT', 'SUPPLY', 'FACILITY']),
  defaultCostPerUnit: z.number().nonnegative().optional(),
  defaultCostUnitPeriod: z.enum(['HOURLY', 'DAILY', 'WEEKLY', 'FLAT']).optional(),
});

catalogRouter.get('/',
  requireAuth,
  requirePermission('facility:read'),
  async (req: Request, res: Response) => {
    const { nimsKind, category } = req.query as Record<string, string>;
    const types = await listResourceTypes({
      healthSystemId: req.user!.healthSystemId,
      facilityId: req.params.facilityId,
      nimsKind: nimsKind as any,
      category: category as any,
    });
    res.json(types);
  },
);

catalogRouter.post('/',
  requireAuth,
  requirePermission('facility:edit'),
  validate(createTypeSchema),
  async (req: Request, res: Response) => {
    const rt = await createResourceType({
      ...req.body,
      facilityId: req.params.facilityId,
      healthSystemId: req.user!.healthSystemId,
      createdBy: req.user!.id,
    });
    res.status(201).json(rt);
  },
);

catalogRouter.get('/inventory',
  requireAuth,
  requirePermission('facility:read'),
  async (req: Request, res: Response) => {
    const inv = await getFacilityInventory(req.params.facilityId);
    res.json(inv);
  },
);

catalogRouter.put('/inventory/:resourceTypeId',
  requireAuth,
  requirePermission('facility:edit'),
  async (req: Request, res: Response) => {
    const inv = await upsertInventoryItem({
      facilityId: req.params.facilityId,
      resourceTypeId: req.params.resourceTypeId,
      ...req.body,
      lastUpdatedBy: req.user!.id,
    });
    res.json(inv);
  },
);

catalogRouter.get('/:typeId',
  requireAuth,
  requirePermission('facility:read'),
  async (req: Request, res: Response) => {
    const rt = await getResourceType(req.params.typeId);
    res.json(rt);
  },
);

catalogRouter.patch('/:typeId',
  requireAuth,
  requirePermission('facility:edit'),
  async (req: Request, res: Response) => {
    const updated = await updateResourceType(req.params.typeId, req.body);
    res.json(updated);
  },
);

catalogRouter.delete('/:typeId',
  requireAuth,
  requirePermission('facility:edit'),
  async (req: Request, res: Response) => {
    await softDeleteResourceType(req.params.typeId);
    res.json({ message: 'Resource type deleted' });
  },
);

export { router as resourcesRouter, catalogRouter as resourceCatalogRouter };
