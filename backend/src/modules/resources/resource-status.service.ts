/**
 * ICS Resource Lifecycle — Status Transition State Machine
 *
 * Valid transitions:
 *
 *   ORDERED ──► IN_TRANSIT ──► AVAILABLE ──► ASSIGNED ──► AVAILABLE  (cyclic)
 *                                 │               │
 *                                 └──► OUT_OF_SERVICE ──► AVAILABLE
 *                                                     └──► DEMOBILIZED
 *   Any state ──► DEMOBILIZED  (IC can demob anything)
 *   Any state ──► OUT_OF_SERVICE
 *
 * Append-only history is written on every transition.
 */

import { ResourceStatus, HicsRole } from '@prisma/client';
import { prisma } from '../../config/database';
import { emitToIncident } from '../../socket';
import { SocketEvents } from '../../socket';
import { writeAuditLog } from '../../utils/audit';
import { AppError } from '../../utils/appError';

// ─── Transition table ────────────────────────────────────────────────────────

const VALID_TRANSITIONS: Record<ResourceStatus, ResourceStatus[]> = {
  ORDERED:         ['IN_TRANSIT', 'AVAILABLE', 'OUT_OF_SERVICE', 'DEMOBILIZED'],
  IN_TRANSIT:      ['AVAILABLE', 'OUT_OF_SERVICE', 'DEMOBILIZED'],
  AVAILABLE:       ['ASSIGNED', 'OUT_OF_SERVICE', 'DEMOBILIZED'],
  ASSIGNED:        ['AVAILABLE', 'OUT_OF_SERVICE', 'DEMOBILIZED'],
  OUT_OF_SERVICE:  ['AVAILABLE', 'DEMOBILIZED'],
  DEMOBILIZED:     [], // terminal state
};

/** Timestamp fields that get set on specific status transitions */
const STATUS_TIMESTAMP_MAP: Partial<Record<ResourceStatus, string>> = {
  ORDERED:         'orderedAt',
  IN_TRANSIT:      'inTransitAt',
  ASSIGNED:        'assignedAt',
  AVAILABLE:       'availableAt',
  OUT_OF_SERVICE:  'outOfServiceAt',
  DEMOBILIZED:     'demobilizedAt',
};

// ─── Public API ───────────────────────────────────────────────────────────────

export function canTransitionResource(from: ResourceStatus, to: ResourceStatus): boolean {
  return VALID_TRANSITIONS[from].includes(to);
}

export interface TransitionResourceOptions {
  incidentResourceId: string;
  toStatus: ResourceStatus;
  changedByUserId: string;
  location?: string;
  notes?: string;
  assignedToRole?: HicsRole;
  assignedToLocation?: string;
}

export async function transitionResourceStatus(opts: TransitionResourceOptions) {
  const {
    incidentResourceId, toStatus, changedByUserId,
    location, notes, assignedToRole, assignedToLocation,
  } = opts;

  const resource = await prisma.incidentResource.findFirst({
    where: { id: incidentResourceId, isDeleted: false },
    include: { incident: { select: { id: true, facilityId: true, incidentNumber: true } } },
  });

  if (!resource) throw new AppError('Resource not found', 404);
  if (resource.status === toStatus) throw new AppError(`Resource is already ${toStatus}`, 409);

  if (!canTransitionResource(resource.status, toStatus)) {
    throw new AppError(
      `Invalid transition: ${resource.status} → ${toStatus}. ` +
      `Allowed: ${VALID_TRANSITIONS[resource.status].join(', ') || 'none (terminal state)'}`,
      409,
    );
  }

  const now = new Date();
  const timestampField = STATUS_TIMESTAMP_MAP[toStatus];

  // Build the update payload for the resource record
  const updateData: Record<string, unknown> = {
    status: toStatus,
    ...(timestampField ? { [timestampField]: now } : {}),
    ...(assignedToRole !== undefined ? { assignedToRole } : {}),
    ...(assignedToLocation !== undefined ? { assignedToLocation } : {}),
    // When demobilized, clear assignment fields
    ...(toStatus === 'DEMOBILIZED' ? { assignedToRole: null, assignedToLocation: null } : {}),
    // When leaving ASSIGNED, clear assignment fields
    ...(resource.status === 'ASSIGNED' && toStatus !== 'ASSIGNED' ? {
      assignedToRole: null,
      assignedToLocation: null,
    } : {}),
  };

  // Write the status history entry + update the resource in a transaction
  const [updated] = await prisma.$transaction([
    prisma.incidentResource.update({
      where: { id: incidentResourceId },
      data: updateData as Parameters<typeof prisma.incidentResource.update>[0]['data'],
    }),
    prisma.resourceStatusHistory.create({
      data: {
        incidentResourceId,
        fromStatus: resource.status,
        toStatus,
        changedByUserId,
        changedAt: now,
        location,
        notes,
      },
    }),
  ]);

  // Emit real-time update
  emitToIncident(resource.incident.id, SocketEvents.RESOURCE_STATUS_CHANGED, {
    incidentId: resource.incident.id,
    resourceId: incidentResourceId,
    name: resource.name,
    fromStatus: resource.status,
    toStatus,
    changedByUserId,
    changedAt: now.toISOString(),
  });

  await writeAuditLog({
    actorUserId: changedByUserId,
    facilityId: resource.incident.facilityId,
    incidentId: resource.incident.id,
    action: 'RESOURCE_STATUS_CHANGED',
    resourceType: 'IncidentResource',
    resourceId: incidentResourceId,
    changes: { before: { status: resource.status }, after: { status: toStatus } },
    metadata: { location, notes },
  });

  return updated;
}

/** Batch check-in: move multiple resources from ORDERED/IN_TRANSIT → AVAILABLE */
export async function bulkCheckIn(
  resourceIds: string[],
  changedByUserId: string,
  location?: string,
) {
  const results = await Promise.allSettled(
    resourceIds.map((id) =>
      transitionResourceStatus({
        incidentResourceId: id,
        toStatus: 'AVAILABLE',
        changedByUserId,
        location,
        notes: 'Bulk check-in',
      }),
    ),
  );

  const succeeded = results
    .filter((r): r is PromiseFulfilledResult<Awaited<ReturnType<typeof transitionResourceStatus>>> => r.status === 'fulfilled')
    .map((r) => r.value);

  const failed = results
    .filter((r): r is PromiseRejectedResult => r.status === 'rejected')
    .map((r, i) => ({ id: resourceIds[i], error: String(r.reason?.message ?? r.reason) }));

  return { succeeded: succeeded.length, failed };
}

/** Get the full status history for a resource */
export async function getResourceStatusHistory(incidentResourceId: string) {
  return prisma.resourceStatusHistory.findMany({
    where: { incidentResourceId },
    orderBy: { changedAt: 'asc' },
    include: {
      incidentResource: { select: { name: true, nimsKind: true } },
    },
  });
}
