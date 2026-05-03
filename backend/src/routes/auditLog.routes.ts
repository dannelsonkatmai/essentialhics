import { Router, Response } from 'express';
import { z } from 'zod';
import { stringify as csvStringify } from 'csv-stringify/sync';
import { prisma } from '../config/database';
import { requireAuth } from '../middleware/auth.middleware';
import { requirePermission } from '../middleware/rbac.middleware';
import { validate } from '../middleware/validate.middleware';
import { AuditAction } from '@prisma/client';
import type { AuthenticatedRequest } from '../types';

const router = Router();

const filterSchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(500).default(50),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  actorUserId: z.string().uuid().optional(),
  facilityId: z.string().uuid().optional(),
  action: z.nativeEnum(AuditAction).optional(),
  resourceType: z.string().optional(),
});

function buildWhere(query: z.infer<typeof filterSchema>) {
  const where: any = {};
  if (query.startDate || query.endDate) {
    where.timestamp = {};
    if (query.startDate) where.timestamp.gte = new Date(query.startDate);
    if (query.endDate) where.timestamp.lte = new Date(query.endDate);
  }
  if (query.actorUserId) where.actorUserId = query.actorUserId;
  if (query.facilityId) where.facilityId = query.facilityId;
  if (query.action) where.action = query.action;
  if (query.resourceType) where.resourceType = query.resourceType;
  return where;
}

// GET /api/audit-logs
router.get(
  '/',
  requireAuth,
  requirePermission('audit_log:read', { scopeFacility: false }),
  validate(filterSchema, 'query'),
  async (req: AuthenticatedRequest, res: Response) => {
    const query = req.query as unknown as z.infer<typeof filterSchema>;
    const { page, limit } = query;
    const where = buildWhere(query);

    const [total, logs] = await Promise.all([
      prisma.auditLog.count({ where }),
      prisma.auditLog.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        include: {
          actorUser: { select: { id: true, email: true, firstName: true, lastName: true } },
          facility: { select: { id: true, name: true, shortName: true } },
        },
        orderBy: { timestamp: 'desc' },
      }),
    ]);

    res.json({
      data: logs,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  },
);

// GET /api/audit-logs/export  (CSV)
router.get(
  '/export',
  requireAuth,
  requirePermission('audit_log:read', { scopeFacility: false }),
  validate(filterSchema.omit({ page: true, limit: true }), 'query'),
  async (req: AuthenticatedRequest, res: Response) => {
    const query = req.query as unknown as z.infer<typeof filterSchema>;
    const where = buildWhere(query);

    const logs = await prisma.auditLog.findMany({
      where,
      orderBy: { timestamp: 'desc' },
      take: 50000, // safety cap for exports
      include: {
        actorUser: { select: { email: true } },
        facility: { select: { shortName: true } },
      },
    });

    const rows = logs.map((l) => ({
      timestamp: l.timestamp.toISOString(),
      actor_email: l.actorUser?.email ?? '(system)',
      actor_ip: l.actorIpAddress ?? '',
      facility: l.facility?.shortName ?? '',
      action: l.action,
      resource_type: l.resourceType,
      resource_id: l.resourceId,
      changes: l.changes ? JSON.stringify(l.changes) : '',
      metadata: l.metadata ? JSON.stringify(l.metadata) : '',
    }));

    const csv = csvStringify(rows, { header: true });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="audit-log-${Date.now()}.csv"`);
    res.send(csv);
  },
);

export default router;
