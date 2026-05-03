import { IncidentStatus, IncidentType, IncidentSeverity, OperationalPeriodStatus } from '@prisma/client';
import { prisma } from '../../config/database';
import { writeAuditLog } from '../../utils/audit';
import type { AuthenticatedUser, PaginatedResponse } from '../../types';

export interface CreateIncidentDto {
  name: string;
  incidentType: IncidentType;
  severity: IncidentSeverity;
  declarationTime: Date;
  location?: string;
  description?: string;
  isExercise: boolean;
  incidentCommanderId?: string;
  facilityId: string;
}

export interface UpdateIncidentDto {
  name?: string;
  severity?: IncidentSeverity;
  description?: string;
  location?: string;
  incidentCommanderId?: string;
}

export interface CreateOperationalPeriodDto {
  startTime: Date;
  endTime: Date;
  objectives?: string;
}

async function nextIncidentNumber(facilityId: string, healthSystemId: string): Promise<string> {
  const facility = await prisma.facility.findUniqueOrThrow({ where: { id: facilityId } });
  const year = new Date().getFullYear();
  // Pad to 4 digits: {CODE}-{YYYY}-{0001}
  const count = await prisma.incident.count({
    where: { facilityId, isDeleted: false },
  });
  const seq = String(count + 1).padStart(4, '0');
  // Use first 4 chars of facility name as code
  const code = facility.name.replace(/[^A-Za-z]/g, '').slice(0, 4).toUpperCase().padEnd(4, 'X');
  return `${code}-${year}-${seq}`;
}

export async function listIncidents(
  user: AuthenticatedUser,
  facilityId: string,
  query: { status?: IncidentStatus; page: number; limit: number },
): Promise<PaginatedResponse<object>> {
  const where = {
    facilityId,
    isDeleted: false,
    ...(query.status ? { status: query.status } : {}),
  };

  const [total, incidents] = await Promise.all([
    prisma.incident.count({ where }),
    prisma.incident.findMany({
      where,
      orderBy: { declarationTime: 'desc' },
      skip: (query.page - 1) * query.limit,
      take: query.limit,
      include: {
        incidentCommander: { select: { id: true, firstName: true, lastName: true } },
        _count: { select: { operationalPeriods: true } },
      },
    }),
  ]);

  return {
    data: incidents,
    pagination: { page: query.page, limit: query.limit, total, totalPages: Math.ceil(total / query.limit) },
  };
}

export async function getIncident(id: string, facilityId: string) {
  return prisma.incident.findFirst({
    where: { id, facilityId, isDeleted: false },
    include: {
      incidentCommander: { select: { id: true, firstName: true, lastName: true, email: true } },
      operationalPeriods: {
        where: { isDeleted: false },
        orderBy: { periodNumber: 'asc' },
        include: {
          _count: {
            select: {
              iapForms201: true,
              iapForms202: true,
              iapForms203: true,
              iapForms204: true,
            },
          },
        },
      },
      _count: { select: { positionAssignments: { where: { isActive: true } } } },
    },
  });
}

export async function createIncident(dto: CreateIncidentDto, user: AuthenticatedUser) {
  const facility = await prisma.facility.findUniqueOrThrow({ where: { id: dto.facilityId } });
  const incidentNumber = await nextIncidentNumber(dto.facilityId, facility.healthSystemId);

  const incident = await prisma.incident.create({
    data: {
      facilityId: dto.facilityId,
      healthSystemId: facility.healthSystemId,
      incidentNumber,
      name: dto.name,
      incidentType: dto.incidentType,
      status: IncidentStatus.ACTIVE,
      severity: dto.severity,
      declarationTime: dto.declarationTime,
      location: dto.location,
      description: dto.description,
      isExercise: dto.isExercise,
      createdById: user.id,
      incidentCommanderId: dto.incidentCommanderId ?? null,
    },
  });

  await writeAuditLog({
    userId: user.id,
    action: 'INCIDENT_CREATED',
    resourceType: 'Incident',
    resourceId: incident.id,
    facilityId: dto.facilityId,
    healthSystemId: facility.healthSystemId,
    newValues: incident,
  });

  return incident;
}

export async function updateIncident(
  id: string,
  facilityId: string,
  dto: UpdateIncidentDto,
  user: AuthenticatedUser,
) {
  const existing = await prisma.incident.findFirstOrThrow({ where: { id, facilityId, isDeleted: false } });

  const updated = await prisma.incident.update({
    where: { id },
    data: { ...dto },
  });

  await writeAuditLog({
    userId: user.id,
    action: 'INCIDENT_UPDATED',
    resourceType: 'Incident',
    resourceId: id,
    facilityId,
    healthSystemId: existing.healthSystemId,
    oldValues: existing,
    newValues: updated,
  });

  return updated;
}

export async function closeIncident(id: string, facilityId: string, user: AuthenticatedUser) {
  const existing = await prisma.incident.findFirstOrThrow({
    where: { id, facilityId, isDeleted: false, status: { not: IncidentStatus.CLOSED } },
  });

  const updated = await prisma.incident.update({
    where: { id },
    data: { status: IncidentStatus.CLOSED, closedAt: new Date(), closedById: user.id },
  });

  await writeAuditLog({
    userId: user.id,
    action: 'INCIDENT_CLOSED',
    resourceType: 'Incident',
    resourceId: id,
    facilityId,
    healthSystemId: existing.healthSystemId,
  });

  return updated;
}

// ── Operational Periods ─────────────────────────────────────────────────────

export async function listOperationalPeriods(incidentId: string, facilityId: string) {
  await prisma.incident.findFirstOrThrow({ where: { id: incidentId, facilityId, isDeleted: false } });

  return prisma.operationalPeriod.findMany({
    where: { incidentId, isDeleted: false },
    orderBy: { periodNumber: 'asc' },
    include: {
      iap: { select: { id: true, status: true, completenessScore: true } },
    },
  });
}

export async function createOperationalPeriod(
  incidentId: string,
  facilityId: string,
  dto: CreateOperationalPeriodDto,
  user: AuthenticatedUser,
) {
  const incident = await prisma.incident.findFirstOrThrow({ where: { id: incidentId, facilityId, isDeleted: false } });

  const count = await prisma.operationalPeriod.count({ where: { incidentId } });

  const period = await prisma.operationalPeriod.create({
    data: {
      incidentId,
      periodNumber: count + 1,
      startTime: dto.startTime,
      endTime: dto.endTime,
      objectives: dto.objectives ?? null,
      status: OperationalPeriodStatus.PLANNING,
      createdById: user.id,
    },
  });

  // Auto-create an IAP in DRAFT for the new period
  await prisma.iap.create({
    data: {
      operationalPeriodId: period.id,
      status: 'DRAFT',
      completenessScore: 0,
      createdById: user.id,
    },
  });

  return period;
}

export async function activateOperationalPeriod(
  incidentId: string,
  periodId: string,
  facilityId: string,
  user: AuthenticatedUser,
) {
  const incident = await prisma.incident.findFirstOrThrow({ where: { id: incidentId, facilityId, isDeleted: false } });

  // Deactivate any currently active period
  await prisma.operationalPeriod.updateMany({
    where: { incidentId, status: OperationalPeriodStatus.ACTIVE },
    data: { status: OperationalPeriodStatus.COMPLETE },
  });

  return prisma.operationalPeriod.update({
    where: { id: periodId },
    data: { status: OperationalPeriodStatus.ACTIVE },
  });
}
