import { HicsRole } from '@prisma/client';
import { prisma } from '../../config/database';
import { emitToIncident, SocketEvents } from '../../socket';
import { writeAuditLog } from '../../utils/audit';
import type { AuthenticatedUser } from '../../types';

export async function getOrgBoard(incidentId: string) {
  return prisma.incidentPositionAssignment.findMany({
    where: { incidentId, isDeleted: false },
    include: {
      assignedUser: { select: { id: true, firstName: true, lastName: true, email: true } },
    },
    orderBy: { hicsRole: 'asc' },
  });
}

export async function assignPosition(
  incidentId: string,
  hicsRole: HicsRole,
  userId: string,
  facilityId: string,
  user: AuthenticatedUser,
) {
  // Relieve any current active holder of this role in this incident
  await prisma.incidentPositionAssignment.updateMany({
    where: { incidentId, hicsRole, isActive: true },
    data: { isActive: false, relievedAt: new Date(), relievedById: user.id },
  });

  const assignment = await prisma.incidentPositionAssignment.create({
    data: {
      incidentId,
      hicsRole,
      assignedUserId: userId,
      assignedById: user.id,
      isActive: true,
    },
    include: {
      assignedUser: { select: { id: true, firstName: true, lastName: true, email: true } },
    },
  });

  await writeAuditLog({
    userId: user.id,
    action: 'POSITION_ASSIGNED',
    resourceType: 'IncidentPositionAssignment',
    resourceId: assignment.id,
    facilityId,
    healthSystemId: user.healthSystemId,
    newValues: { hicsRole, assignedUserId: userId },
  });

  emitToIncident(incidentId, SocketEvents.POSITION_ASSIGNED, {
    incidentId,
    hicsRole,
    assignment: {
      id: assignment.id,
      hicsRole,
      assignedUser: assignment.assignedUser,
      assignedAt: assignment.assignedAt,
    },
  });

  return assignment;
}

export async function relievePosition(
  assignmentId: string,
  incidentId: string,
  facilityId: string,
  user: AuthenticatedUser,
) {
  const assignment = await prisma.incidentPositionAssignment.findFirstOrThrow({
    where: { id: assignmentId, incidentId, isActive: true },
  });

  const updated = await prisma.incidentPositionAssignment.update({
    where: { id: assignmentId },
    data: { isActive: false, relievedAt: new Date(), relievedById: user.id },
  });

  await writeAuditLog({
    userId: user.id,
    action: 'POSITION_RELIEVED',
    resourceType: 'IncidentPositionAssignment',
    resourceId: assignmentId,
    facilityId,
    healthSystemId: user.healthSystemId,
  });

  emitToIncident(incidentId, SocketEvents.POSITION_RELIEVED, {
    incidentId,
    hicsRole: assignment.hicsRole,
    assignmentId,
  });

  return updated;
}

export async function vacatePosition(
  incidentId: string,
  hicsRole: HicsRole,
  facilityId: string,
  user: AuthenticatedUser,
) {
  await prisma.incidentPositionAssignment.updateMany({
    where: { incidentId, hicsRole, isActive: true },
    data: { isActive: false, relievedAt: new Date(), relievedById: user.id },
  });

  emitToIncident(incidentId, SocketEvents.POSITION_VACANT, { incidentId, hicsRole });
}

/**
 * Sync current active position assignments into ICS-203 org assignment section.
 * Called after bulk re-assignment on the org board.
 */
export async function syncToForm203(
  iapId: string,
  incidentId: string,
  user: AuthenticatedUser,
) {
  const assignments = await prisma.incidentPositionAssignment.findMany({
    where: { incidentId, isActive: true },
    include: {
      assignedUser: { select: { id: true, firstName: true, lastName: true } },
    },
  });

  const assignmentMap: Record<string, { id: string; firstName: string; lastName: string }> = {};
  for (const a of assignments) {
    if (a.assignedUser) {
      assignmentMap[a.hicsRole] = a.assignedUser;
    }
  }

  const iap = await prisma.iap.findUniqueOrThrow({
    where: { id: iapId },
    include: {
      operationalPeriod: {
        include: { iapForms203: { orderBy: { createdAt: 'desc' }, take: 1 } },
      },
    },
  });

  const existing = iap.operationalPeriod.iapForms203[0];
  const currentData = (existing?.formData as Record<string, unknown>) ?? {};

  const icName = assignmentMap['INCIDENT_COMMANDER']
    ? `${assignmentMap['INCIDENT_COMMANDER'].firstName} ${assignmentMap['INCIDENT_COMMANDER'].lastName}`
    : null;

  const formData = {
    ...currentData,
    incidentCommanderName: icName ?? currentData['incidentCommanderName'],
    operationsSection: assignmentMap['OPERATIONS_SECTION_CHIEF']
      ? { chief: `${assignmentMap['OPERATIONS_SECTION_CHIEF'].firstName} ${assignmentMap['OPERATIONS_SECTION_CHIEF'].lastName}` }
      : currentData['operationsSection'],
    planningSection: assignmentMap['PLANNING_SECTION_CHIEF']
      ? { chief: `${assignmentMap['PLANNING_SECTION_CHIEF'].firstName} ${assignmentMap['PLANNING_SECTION_CHIEF'].lastName}` }
      : currentData['planningSection'],
    logisticsSection: assignmentMap['LOGISTICS_SECTION_CHIEF']
      ? { chief: `${assignmentMap['LOGISTICS_SECTION_CHIEF'].firstName} ${assignmentMap['LOGISTICS_SECTION_CHIEF'].lastName}` }
      : currentData['logisticsSection'],
    financeSection: assignmentMap['FINANCE_ADMINISTRATION_SECTION_CHIEF']
      ? { chief: `${assignmentMap['FINANCE_ADMINISTRATION_SECTION_CHIEF'].firstName} ${assignmentMap['FINANCE_ADMINISTRATION_SECTION_CHIEF'].lastName}` }
      : currentData['financeSection'],
    _syncedFromOrgBoard: true,
    _syncedAt: new Date().toISOString(),
  };

  if (existing) {
    await prisma.iapForm203.update({
      where: { id: existing.id },
      data: { formData, lastEditedById: user.id },
    });
  } else {
    await prisma.iapForm203.create({
      data: {
        operationalPeriodId: iap.operationalPeriodId,
        formData,
        lastEditedById: user.id,
      },
    });
  }

  return formData;
}
