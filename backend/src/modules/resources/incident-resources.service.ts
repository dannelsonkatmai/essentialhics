/**
 * Incident Resources — CRUD + summary queries for resources deployed on an incident.
 * All status changes go through resource-status.service.ts (state machine).
 */

import { NimsKind, ResourceSource, ResourceStatus, HicsRole, CostUnitPeriod } from '@prisma/client';
import { Decimal } from 'decimal.js';
import { prisma } from '../../config/database';
import { AppError } from '../../utils/appError';
import { writeAuditLog } from '../../utils/audit';
import { transitionResourceStatus } from './resource-status.service';

export interface CreateIncidentResourceInput {
  incidentId: string;
  facilityId: string;
  resourceTypeId?: string;
  name: string;
  nimsKind: NimsKind;
  quantity?: number;
  unit?: string;
  source?: ResourceSource;
  resourceIdentifier?: string;
  homeBaseOrgName?: string;
  homeBaseContact?: string;
  requestId?: string;
  eta?: Date | string;
  assignedToRole?: HicsRole;
  assignedToLocation?: string;
  costPerUnit?: number | string;
  costUnitPeriod?: CostUnitPeriod;
  notes?: string;
  createdBy: string;
}

export async function listIncidentResources(incidentId: string, opts?: {
  status?: ResourceStatus;
  nimsKind?: NimsKind;
  source?: ResourceSource;
}) {
  return prisma.incidentResource.findMany({
    where: {
      incidentId,
      isDeleted: false,
      ...(opts?.status ? { status: opts.status } : {}),
      ...(opts?.nimsKind ? { nimsKind: opts.nimsKind } : {}),
      ...(opts?.source ? { source: opts.source } : {}),
    },
    include: {
      resourceType: { select: { id: true, name: true, nimsKind: true, unit: true } },
      statusHistory: { orderBy: { changedAt: 'desc' }, take: 1 },
      assignments: {
        where: { releasedAt: null },
        orderBy: { assignedAt: 'desc' },
        take: 1,
      },
    },
    orderBy: [{ status: 'asc' }, { name: 'asc' }],
  });
}

export async function getIncidentResource(id: string) {
  const resource = await prisma.incidentResource.findFirst({
    where: { id, isDeleted: false },
    include: {
      resourceType: true,
      statusHistory: { orderBy: { changedAt: 'asc' } },
      assignments: { orderBy: { assignedAt: 'desc' } },
      fulfillments: true,
      request: { select: { id: true, requestNumber: true, status: true } },
    },
  });
  if (!resource) throw new AppError('Incident resource not found', 404);
  return resource;
}

export async function createIncidentResource(input: CreateIncidentResourceInput) {
  const resource = await prisma.incidentResource.create({
    data: {
      incidentId: input.incidentId,
      facilityId: input.facilityId,
      resourceTypeId: input.resourceTypeId ?? null,
      name: input.name,
      nimsKind: input.nimsKind,
      quantity: input.quantity != null ? new Decimal(input.quantity).toFixed(2) : '1.00',
      unit: input.unit ?? 'each',
      source: input.source ?? 'INTERNAL',
      status: 'ORDERED',
      resourceIdentifier: input.resourceIdentifier ?? null,
      homeBaseOrgName: input.homeBaseOrgName ?? null,
      homeBaseContact: input.homeBaseContact ?? null,
      requestId: input.requestId ?? null,
      eta: input.eta ? new Date(input.eta) : null,
      assignedToRole: input.assignedToRole ?? null,
      assignedToLocation: input.assignedToLocation ?? null,
      costPerUnit: input.costPerUnit != null
        ? new Decimal(input.costPerUnit).toFixed(4)
        : null,
      costUnitPeriod: input.costUnitPeriod ?? null,
      orderedAt: new Date(),
      notes: input.notes ?? null,
      createdBy: input.createdBy,
    },
  });

  // Write initial status history entry (ORDERED)
  await prisma.resourceStatusHistory.create({
    data: {
      incidentResourceId: resource.id,
      fromStatus: null,
      toStatus: 'ORDERED',
      changedByUserId: input.createdBy,
      notes: 'Resource created and ordered',
    },
  });

  await writeAuditLog({
    actorUserId: input.createdBy,
    facilityId: input.facilityId,
    incidentId: input.incidentId,
    action: 'RESOURCE_CREATED',
    resourceType: 'IncidentResource',
    resourceId: resource.id,
    changes: { after: { name: resource.name, nimsKind: resource.nimsKind, source: resource.source } },
  });

  return resource;
}

export async function updateIncidentResource(
  id: string,
  updates: Partial<CreateIncidentResourceInput>,
  updatedByUserId: string,
) {
  const resource = await prisma.incidentResource.findFirst({ where: { id, isDeleted: false } });
  if (!resource) throw new AppError('Incident resource not found', 404);

  const updated = await prisma.incidentResource.update({
    where: { id },
    data: {
      ...(updates.name !== undefined ? { name: updates.name } : {}),
      ...(updates.resourceIdentifier !== undefined ? { resourceIdentifier: updates.resourceIdentifier } : {}),
      ...(updates.homeBaseOrgName !== undefined ? { homeBaseOrgName: updates.homeBaseOrgName } : {}),
      ...(updates.homeBaseContact !== undefined ? { homeBaseContact: updates.homeBaseContact } : {}),
      ...(updates.eta !== undefined ? { eta: updates.eta ? new Date(updates.eta) : null } : {}),
      ...(updates.assignedToRole !== undefined ? { assignedToRole: updates.assignedToRole } : {}),
      ...(updates.assignedToLocation !== undefined ? { assignedToLocation: updates.assignedToLocation } : {}),
      ...(updates.costPerUnit != null
        ? { costPerUnit: new Decimal(updates.costPerUnit).toFixed(4) }
        : {}),
      ...(updates.costUnitPeriod !== undefined ? { costUnitPeriod: updates.costUnitPeriod } : {}),
      ...(updates.notes !== undefined ? { notes: updates.notes } : {}),
    },
  });

  await writeAuditLog({
    actorUserId: updatedByUserId,
    facilityId: resource.facilityId,
    incidentId: resource.incidentId,
    action: 'RESOURCE_UPDATED',
    resourceType: 'IncidentResource',
    resourceId: id,
  });

  return updated;
}

export async function softDeleteIncidentResource(id: string, deletedByUserId: string) {
  const resource = await prisma.incidentResource.findFirst({ where: { id, isDeleted: false } });
  if (!resource) throw new AppError('Incident resource not found', 404);

  return prisma.incidentResource.update({
    where: { id },
    data: { isDeleted: true, deletedAt: new Date() },
  });
}

/** Demobilize a resource (transitions status to DEMOBILIZED via state machine) */
export async function demobilizeResource(id: string, changedByUserId: string, notes?: string) {
  const updated = await transitionResourceStatus({
    incidentResourceId: id,
    toStatus: 'DEMOBILIZED',
    changedByUserId,
    notes: notes ?? 'Demobilized',
  });

  await writeAuditLog({
    actorUserId: changedByUserId,
    incidentId: updated.incidentId,
    facilityId: updated.facilityId,
    action: 'RESOURCE_DEMOBILIZED',
    resourceType: 'IncidentResource',
    resourceId: id,
  });

  return updated;
}

/** Resource summary counts grouped by status — used by the status board */
export async function getResourceSummary(incidentId: string) {
  const rows = await prisma.incidentResource.groupBy({
    by: ['status'],
    where: { incidentId, isDeleted: false },
    _count: { id: true },
  });

  const summary: Record<ResourceStatus, number> = {
    ORDERED: 0, IN_TRANSIT: 0, ASSIGNED: 0, AVAILABLE: 0, OUT_OF_SERVICE: 0, DEMOBILIZED: 0,
  };

  for (const row of rows) {
    summary[row.status] = row._count.id;
  }

  return summary;
}
