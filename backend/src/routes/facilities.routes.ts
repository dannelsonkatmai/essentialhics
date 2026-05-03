import { Router, Response } from 'express';
import { z } from 'zod';
import { parse as csvParse } from 'csv-parse/sync';
import multer from 'multer';
import { prisma } from '../config/database';
import { requireAuth } from '../middleware/auth.middleware';
import { requirePermission } from '../middleware/rbac.middleware';
import { validate } from '../middleware/validate.middleware';
import { writeAuditLog, diffObjects, extractRequestMeta } from '../utils/audit';
import { generateSecureToken } from '../utils/tokens';
import { sendInviteEmail } from '../services/email.service';
import { config } from '../config';
import type { AuthenticatedRequest } from '../types';
import { FacilityType, HicsRole, AuthProvider } from '@prisma/client';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

// ── Schemas ───────────────────────────────────────────────────────────────────

const createFacilitySchema = z.object({
  name: z.string().min(1).max(200),
  shortName: z.string().min(1).max(20),
  address: z.object({
    street: z.string(),
    city: z.string(),
    state: z.string().length(2),
    zip: z.string().regex(/^\d{5}(-\d{4})?$/),
  }),
  phone: z.string().optional(),
  fax: z.string().optional(),
  licenseNumber: z.string().optional(),
  facilityType: z.nativeEnum(FacilityType).optional(),
  timezone: z.string().default('America/New_York'),
  emergencyContactName: z.string().optional(),
  emergencyContactPhone: z.string().optional(),
});

const updateFacilitySchema = createFacilitySchema.partial().extend({
  isActive: z.boolean().optional(),
});

const createDepartmentSchema = z.object({
  name: z.string().min(1).max(200),
  code: z.string().min(1).max(20),
  parentDepartmentId: z.string().uuid().optional(),
});

// ── Facilities ────────────────────────────────────────────────────────────────

// GET /api/facilities
router.get(
  '/',
  requireAuth,
  requirePermission('facility:read', { scopeFacility: false }),
  async (req: AuthenticatedRequest, res: Response) => {
    const facilities = await prisma.facility.findMany({
      where: { isDeleted: false },
      select: {
        id: true, name: true, shortName: true, facilityType: true,
        isActive: true, timezone: true, phone: true, address: true,
        createdAt: true,
        _count: { select: { userFacilityRoles: { where: { isDeleted: false } } } },
      },
      orderBy: { name: 'asc' },
    });

    res.json(facilities);
  },
);

// POST /api/facilities
router.post(
  '/',
  requireAuth,
  requirePermission('facility:edit', { scopeFacility: false }),
  validate(createFacilitySchema),
  async (req: AuthenticatedRequest, res: Response) => {
    const { actorIpAddress, actorUserAgent } = extractRequestMeta(req);

    const hs = await prisma.healthSystem.findFirst({ where: { isDeleted: false } });
    if (!hs) {
      res.status(500).json({ message: 'No health system found.' });
      return;
    }

    const facility = await prisma.facility.create({
      data: { healthSystemId: hs.id, ...req.body },
    });

    await writeAuditLog({
      actorUserId: req.user.id,
      actorIpAddress,
      actorUserAgent,
      facilityId: facility.id,
      action: 'FACILITY_CREATED',
      resourceType: 'Facility',
      resourceId: facility.id,
      changes: { after: req.body },
    });

    res.status(201).json(facility);
  },
);

// GET /api/facilities/:id
router.get(
  '/:id',
  requireAuth,
  requirePermission('facility:read'),
  async (req: AuthenticatedRequest, res: Response) => {
    const facility = await prisma.facility.findUnique({
      where: { id: req.params.id, isDeleted: false },
      include: {
        departments: {
          where: { isDeleted: false },
          orderBy: { name: 'asc' },
        },
        _count: { select: { userFacilityRoles: { where: { isDeleted: false } } } },
      },
    });

    if (!facility) {
      res.status(404).json({ message: 'Facility not found.' });
      return;
    }

    res.json(facility);
  },
);

// PUT /api/facilities/:id
router.put(
  '/:id',
  requireAuth,
  requirePermission('facility:edit'),
  validate(updateFacilitySchema),
  async (req: AuthenticatedRequest, res: Response) => {
    const { actorIpAddress, actorUserAgent } = extractRequestMeta(req);

    const existing = await prisma.facility.findUnique({ where: { id: req.params.id, isDeleted: false } });
    if (!existing) {
      res.status(404).json({ message: 'Facility not found.' });
      return;
    }

    const updated = await prisma.facility.update({
      where: { id: req.params.id },
      data: req.body,
    });

    await writeAuditLog({
      actorUserId: req.user.id,
      actorIpAddress,
      actorUserAgent,
      facilityId: req.params.id,
      action: 'FACILITY_UPDATED',
      resourceType: 'Facility',
      resourceId: req.params.id,
      changes: diffObjects(existing as any, updated as any),
    });

    res.json(updated);
  },
);

// GET /api/facilities/:id/departments
router.get(
  '/:id/departments',
  requireAuth,
  requirePermission('facility:read'),
  async (req: AuthenticatedRequest, res: Response) => {
    const departments = await prisma.department.findMany({
      where: { facilityId: req.params.id, isDeleted: false },
      orderBy: { name: 'asc' },
    });
    res.json(departments);
  },
);

// POST /api/facilities/:id/departments
router.post(
  '/:id/departments',
  requireAuth,
  requirePermission('facility:edit'),
  validate(createDepartmentSchema),
  async (req: AuthenticatedRequest, res: Response) => {
    const dept = await prisma.department.create({
      data: { facilityId: req.params.id, ...req.body },
    });
    res.status(201).json(dept);
  },
);

// GET /api/facilities/:id/users
router.get(
  '/:id/users',
  requireAuth,
  requirePermission('user:read'),
  async (req: AuthenticatedRequest, res: Response) => {
    const page = Number(req.query.page) || 1;
    const limit = Math.min(Number(req.query.limit) || 25, 100);

    const [total, roles] = await Promise.all([
      prisma.userFacilityRole.count({
        where: { facilityId: req.params.id, isDeleted: false },
      }),
      prisma.userFacilityRole.findMany({
        where: { facilityId: req.params.id, isDeleted: false },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          user: {
            select: {
              id: true, email: true, firstName: true, lastName: true,
              jobTitle: true, isActive: true, isLocked: true, lastLoginAt: true,
            },
          },
        },
        orderBy: { assignedAt: 'desc' },
      }),
    ]);

    res.json({
      data: roles,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  },
);

// GET /api/facilities/:id/positions — HICS org chart
router.get(
  '/:id/positions',
  requireAuth,
  requirePermission('facility:read'),
  async (req: AuthenticatedRequest, res: Response) => {
    const positions = await prisma.position.findMany({
      where: { facilityId: req.params.id, isDeleted: false },
      include: { department: { select: { id: true, name: true, code: true } } },
      orderBy: { hicsRole: 'asc' },
    });
    res.json(positions);
  },
);

// POST /api/facilities/:id/users  (create a new user at this facility)
router.post(
  '/:id/users',
  requireAuth,
  requirePermission('user:create'),
  validate(z.object({
    email: z.string().email(),
    firstName: z.string().min(1),
    lastName: z.string().min(1),
    jobTitle: z.string().optional(),
    employeeId: z.string().optional(),
    phoneMobile: z.string().optional(),
    hicsRole: z.nativeEnum(HicsRole),
  })),
  async (req: AuthenticatedRequest, res: Response) => {
    const { actorIpAddress, actorUserAgent } = extractRequestMeta(req);
    const { hicsRole, ...userData } = req.body;

    const hs = await prisma.healthSystem.findFirst({ where: { isDeleted: false } });
    if (!hs) { res.status(500).json({ message: 'No health system.' }); return; }

    const existing = await prisma.user.findUnique({ where: { email: userData.email } });
    if (existing) { res.status(409).json({ message: 'Email already registered.' }); return; }

    const { raw: inviteToken } = generateSecureToken();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    const user = await prisma.user.create({
      data: {
        ...userData,
        healthSystemId: hs.id,
        authProvider: AuthProvider.LOCAL,
        mustChangePassword: true,
        createdBy: req.user.id,
      },
    });

    await prisma.userFacilityRole.create({
      data: { userId: user.id, facilityId: req.params.id, hicsRole, assignedBy: req.user.id },
    });

    const facility = await prisma.facility.findUniqueOrThrow({
      where: { id: req.params.id }, select: { name: true },
    });

    const setPasswordUrl = `${config.FRONTEND_URL}/reset-password?token=${inviteToken}`;
    await sendInviteEmail(userData.email, userData.firstName, setPasswordUrl, facility.name);

    await writeAuditLog({
      actorUserId: req.user.id, actorIpAddress, actorUserAgent,
      facilityId: req.params.id,
      action: 'USER_CREATED', resourceType: 'User', resourceId: user.id,
      changes: { after: { email: userData.email, hicsRole } },
    });

    res.status(201).json({ id: user.id, email: user.email, message: 'Invite email sent.' });
  },
);

// POST /api/facilities/:id/users/import  (bulk CSV import)
router.post(
  '/:id/users/import',
  requireAuth,
  requirePermission('user:create'),
  upload.single('file'),
  async (req: AuthenticatedRequest, res: Response) => {
    const { actorIpAddress, actorUserAgent } = extractRequestMeta(req);

    if (!req.file) {
      res.status(400).json({ message: 'No CSV file uploaded.' });
      return;
    }

    let rows: any[];
    try {
      rows = csvParse(req.file.buffer, { columns: true, skip_empty_lines: true, trim: true });
    } catch {
      res.status(400).json({ message: 'Could not parse CSV. Ensure it has proper headers.' });
      return;
    }

    const required = ['first_name', 'last_name', 'email', 'hics_role'];
    const rowErrors: { row: number; errors: string[] }[] = [];

    const validRoles = Object.values(HicsRole);
    for (let i = 0; i < rows.length; i++) {
      const errs: string[] = [];
      const row = rows[i];
      for (const col of required) {
        if (!row[col]) errs.push(`Missing required column: ${col}`);
      }
      if (row.email && !/\S+@\S+\.\S+/.test(row.email)) errs.push('Invalid email format');
      if (row.hics_role && !validRoles.includes(row.hics_role)) {
        errs.push(`Invalid hics_role: ${row.hics_role}`);
      }
      if (errs.length) rowErrors.push({ row: i + 2, errors: errs }); // +2 for header + 1-index
    }

    if (rowErrors.length) {
      res.status(422).json({ message: 'Validation failed. No users were imported.', errors: rowErrors });
      return;
    }

    const hs = await prisma.healthSystem.findFirst({ where: { isDeleted: false } });
    if (!hs) { res.status(500).json({ message: 'No health system.' }); return; }

    const facility = await prisma.facility.findUniqueOrThrow({
      where: { id: req.params.id }, select: { name: true },
    });

    const created: string[] = [];
    const skipped: string[] = [];

    for (const row of rows) {
      const existing = await prisma.user.findUnique({ where: { email: row.email.toLowerCase() } });
      if (existing) { skipped.push(row.email); continue; }

      const { raw } = generateSecureToken();
      const user = await prisma.user.create({
        data: {
          healthSystemId: hs.id,
          email: row.email.toLowerCase(),
          firstName: row.first_name,
          lastName: row.last_name,
          jobTitle: row.job_title || null,
          employeeId: row.employee_id || null,
          phoneMobile: row.phone_mobile || null,
          authProvider: AuthProvider.LOCAL,
          mustChangePassword: true,
          createdBy: req.user.id,
        },
      });

      await prisma.userFacilityRole.create({
        data: { userId: user.id, facilityId: req.params.id, hicsRole: row.hics_role, assignedBy: req.user.id },
      });

      const url = `${config.FRONTEND_URL}/reset-password?token=${raw}`;
      await sendInviteEmail(user.email, user.firstName, url, facility.name);
      created.push(user.email);
    }

    await writeAuditLog({
      actorUserId: req.user.id, actorIpAddress, actorUserAgent,
      facilityId: req.params.id,
      action: 'USER_CREATED', resourceType: 'User', resourceId: req.params.id,
      metadata: { bulkImport: true, created: created.length, skipped: skipped.length },
    });

    res.json({ created: created.length, skipped: skipped.length, skippedEmails: skipped });
  },
);

export default router;
