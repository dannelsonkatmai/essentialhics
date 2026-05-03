import { Router, Response } from 'express';
import { z } from 'zod';
import { parse as csvParse } from 'csv-parse/sync';
import multer from 'multer';
import { prisma } from '../config/database';
import { requireAuth } from '../middleware/auth.middleware';
import { requirePermission } from '../middleware/rbac.middleware';
import { validate } from '../middleware/validate.middleware';
import { writeAuditLog, diffObjects, extractRequestMeta } from '../utils/audit';
import { hashPassword, validatePasswordPolicy } from '../utils/password';
import { generateSecureToken } from '../utils/tokens';
import { sendInviteEmail } from '../services/email.service';
import { config } from '../config';
import type { AuthenticatedRequest } from '../types';
import { HicsRole } from '@prisma/client';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

// ── Schemas ───────────────────────────────────────────────────────────────────

const createUserSchema = z.object({
  email: z.string().email(),
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  jobTitle: z.string().optional(),
  employeeId: z.string().optional(),
  phoneMobile: z.string().optional(),
  phoneWork: z.string().optional(),
  facilityId: z.string().uuid(),
  hicsRole: z.nativeEnum(HicsRole),
});

const updateUserSchema = z.object({
  firstName: z.string().min(1).max(100).optional(),
  lastName: z.string().min(1).max(100).optional(),
  displayName: z.string().max(150).optional(),
  jobTitle: z.string().optional(),
  phoneMobile: z.string().optional(),
  phoneWork: z.string().optional(),
  pagerNumber: z.string().optional(),
  isActive: z.boolean().optional(),
});

const assignRoleSchema = z.object({
  facilityId: z.string().uuid(),
  hicsRole: z.nativeEnum(HicsRole),
  isPrimaryFacility: z.boolean().optional().default(false),
});

const listUsersSchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(25),
  facilityId: z.string().uuid().optional(),
  role: z.nativeEnum(HicsRole).optional(),
  status: z.enum(['active', 'inactive', 'locked']).optional(),
  search: z.string().optional(),
});

// ── Routes ────────────────────────────────────────────────────────────────────

// GET /api/users
router.get(
  '/',
  requireAuth,
  requirePermission('user:read', { scopeFacility: false }),
  validate(listUsersSchema, 'query'),
  async (req: AuthenticatedRequest, res: Response) => {
    const { page, limit, facilityId, role, status, search } = req.query as any;

    const where: any = { isDeleted: false };

    if (facilityId) {
      where.userFacilityRoles = { some: { facilityId, isDeleted: false } };
    }
    if (role) {
      where.userFacilityRoles = { some: { hicsRole: role, isDeleted: false } };
    }
    if (status === 'active') where.isActive = true;
    if (status === 'inactive') where.isActive = false;
    if (status === 'locked') where.isLocked = true;
    if (search) {
      where.OR = [
        { email: { contains: search, mode: 'insensitive' } },
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [total, users] = await Promise.all([
      prisma.user.count({ where }),
      prisma.user.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          displayName: true,
          jobTitle: true,
          isActive: true,
          isLocked: true,
          lastLoginAt: true,
          createdAt: true,
          userFacilityRoles: {
            where: { isDeleted: false },
            select: { facilityId: true, hicsRole: true, isPrimaryFacility: true },
          },
        },
        orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
      }),
    ]);

    res.json({
      data: users,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  },
);

// GET /api/users/:id
router.get(
  '/:id',
  requireAuth,
  requirePermission('user:read', { scopeFacility: false }),
  async (req: AuthenticatedRequest, res: Response) => {
    const user = await prisma.user.findUnique({
      where: { id: req.params.id, isDeleted: false },
      select: {
        id: true, email: true, firstName: true, lastName: true, displayName: true,
        jobTitle: true, employeeId: true, phoneMobile: true, phoneWork: true, pagerNumber: true,
        authProvider: true, isActive: true, isLocked: true, lastLoginAt: true,
        passwordChangedAt: true, mustChangePassword: true, mfaEnabled: true,
        createdAt: true, updatedAt: true,
        userFacilityRoles: {
          where: { isDeleted: false },
          select: {
            id: true, facilityId: true, hicsRole: true, isPrimaryFacility: true,
            assignedAt: true,
            facility: { select: { name: true, shortName: true } },
          },
        },
        sessions: {
          where: { isRevoked: false, expiresAt: { gt: new Date() } },
          select: { id: true, deviceInfo: true, ipAddress: true, lastUsedAt: true, createdAt: true },
          orderBy: { lastUsedAt: 'desc' },
          take: 10,
        },
      },
    });

    if (!user) {
      res.status(404).json({ message: 'User not found.' });
      return;
    }

    res.json(user);
  },
);

// PUT /api/users/:id
router.put(
  '/:id',
  requireAuth,
  requirePermission('user:edit', { scopeFacility: false }),
  validate(updateUserSchema),
  async (req: AuthenticatedRequest, res: Response) => {
    const { actorIpAddress, actorUserAgent } = extractRequestMeta(req);

    const existing = await prisma.user.findUnique({ where: { id: req.params.id, isDeleted: false } });
    if (!existing) {
      res.status(404).json({ message: 'User not found.' });
      return;
    }

    const updated = await prisma.user.update({
      where: { id: req.params.id },
      data: req.body,
    });

    await writeAuditLog({
      actorUserId: req.user.id,
      actorIpAddress,
      actorUserAgent,
      action: 'USER_UPDATED',
      resourceType: 'User',
      resourceId: req.params.id,
      changes: diffObjects(existing as any, updated as any),
    });

    res.json(updated);
  },
);

// PATCH /api/users/:id/deactivate
router.patch(
  '/:id/deactivate',
  requireAuth,
  requirePermission('user:deactivate', { scopeFacility: false }),
  async (req: AuthenticatedRequest, res: Response) => {
    const { actorIpAddress, actorUserAgent } = extractRequestMeta(req);

    await prisma.$transaction([
      prisma.user.update({ where: { id: req.params.id }, data: { isActive: false } }),
      prisma.session.updateMany({ where: { userId: req.params.id }, data: { isRevoked: true } }),
    ]);

    await writeAuditLog({
      actorUserId: req.user.id,
      actorIpAddress,
      actorUserAgent,
      action: 'USER_DEACTIVATED',
      resourceType: 'User',
      resourceId: req.params.id,
    });

    res.json({ message: 'User deactivated.' });
  },
);

// POST /api/users/:id/roles
router.post(
  '/:id/roles',
  requireAuth,
  requirePermission('user:edit', { scopeFacility: false }),
  validate(assignRoleSchema),
  async (req: AuthenticatedRequest, res: Response) => {
    const { actorIpAddress, actorUserAgent } = extractRequestMeta(req);
    const { facilityId, hicsRole, isPrimaryFacility } = req.body;

    const role = await prisma.userFacilityRole.create({
      data: {
        userId: req.params.id,
        facilityId,
        hicsRole,
        isPrimaryFacility,
        assignedBy: req.user.id,
      },
    });

    await writeAuditLog({
      actorUserId: req.user.id,
      actorIpAddress,
      actorUserAgent,
      facilityId,
      action: 'USER_ROLE_ASSIGNED',
      resourceType: 'UserFacilityRole',
      resourceId: role.id,
      changes: { after: { userId: req.params.id, facilityId, hicsRole } },
    });

    res.status(201).json(role);
  },
);

// DELETE /api/users/:id/roles/:roleId
router.delete(
  '/:id/roles/:roleId',
  requireAuth,
  requirePermission('user:edit', { scopeFacility: false }),
  async (req: AuthenticatedRequest, res: Response) => {
    const { actorIpAddress, actorUserAgent } = extractRequestMeta(req);

    const role = await prisma.userFacilityRole.findUnique({ where: { id: req.params.roleId } });
    if (!role || role.userId !== req.params.id) {
      res.status(404).json({ message: 'Role assignment not found.' });
      return;
    }

    await prisma.userFacilityRole.update({
      where: { id: req.params.roleId },
      data: { isDeleted: true, deletedAt: new Date() },
    });

    await writeAuditLog({
      actorUserId: req.user.id,
      actorIpAddress,
      actorUserAgent,
      facilityId: role.facilityId,
      action: 'USER_ROLE_REMOVED',
      resourceType: 'UserFacilityRole',
      resourceId: req.params.roleId,
      changes: { before: { userId: req.params.id, facilityId: role.facilityId, hicsRole: role.hicsRole } },
    });

    res.json({ message: 'Role removed.' });
  },
);

// POST /api/users/:id/sessions/:sessionId/revoke
router.post(
  '/:id/sessions/:sessionId/revoke',
  requireAuth,
  async (req: AuthenticatedRequest, res: Response) => {
    const { actorIpAddress, actorUserAgent } = extractRequestMeta(req);

    // Users can revoke their own sessions; admins can revoke any
    const canRevoke =
      req.user.id === req.params.id ||
      req.user.roles.some((r) => ['SYSTEM_ADMIN', 'FACILITY_ADMIN'].includes(r.role));

    if (!canRevoke) {
      res.status(403).json({ message: 'Permission denied.' });
      return;
    }

    await prisma.session.updateMany({
      where: { id: req.params.sessionId, userId: req.params.id },
      data: { isRevoked: true },
    });

    await writeAuditLog({
      actorUserId: req.user.id,
      actorIpAddress,
      actorUserAgent,
      action: 'USER_SESSION_REVOKED',
      resourceType: 'Session',
      resourceId: req.params.sessionId,
    });

    res.json({ message: 'Session revoked.' });
  },
);

export default router;
