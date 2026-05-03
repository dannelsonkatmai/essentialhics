/**
 * ICS-213RR Resource Request Workflow State Machine
 *
 * States:
 *   DRAFT ──► SUBMITTED ──► APPROVED ──► PARTIALLY_FILLED ──► FILLED
 *                       └──► DENIED
 *   SUBMITTED ──► CANCELLED (by requester)
 *   APPROVED  ──► CANCELLED (by requester / IC)
 *   DRAFT     ──► CANCELLED
 *   APPROVED  ──► PARTIALLY_FILLED (as fulfillments come in)
 *   PARTIALLY_FILLED ──► FILLED (when all line items 100% filled)
 *
 * Auto-numbering: 213RR-{incidentNumber}-{####}  (4-digit, zero-padded, per-incident)
 */

import { RequestStatus, RequestPriority, HicsRole } from '@prisma/client';
import { Decimal } from 'decimal.js';
import { prisma } from '../../config/database';
import { AppError } from '../../utils/appError';
import { writeAuditLog } from '../../utils/audit';
import { createNotification } from '../notifications/notification.service';
import { emitToIncident, SocketEvents } from '../../socket';

// ─── Transition rules ─────────────────────────────────────────────────────────

const VALID_TRANSITIONS: Record<RequestStatus, RequestStatus[]> = {
  DRAFT:            ['SUBMITTED', 'CANCELLED'],
  SUBMITTED:        ['APPROVED', 'DENIED', 'CANCELLED'],
  APPROVED:         ['PARTIALLY_FILLED', 'FILLED', 'CANCELLED'],
  PARTIALLY_FILLED: ['FILLED', 'CANCELLED'],
  FILLED:           [],              // terminal
  CANCELLED:        [],              // terminal
  DENIED:           [],              // terminal
};

export function canTransitionRequest(from: RequestStatus, to: RequestStatus): boolean {
  return VALID_TRANSITIONS[from].includes(to);
}

// ─── Auto-number generation ────────────────────────────────────────────────────

async function generateRequestNumber(incidentId: string): Promise<string> {
  const incident = await prisma.incident.findUnique({
    where: { id: incidentId },
    select: { incidentNumber: true },
  });
  if (!incident) throw new AppError('Incident not found', 404);

  const existing = await prisma.resourceRequest.count({
    where: { incidentId, isDeleted: false },
  });

  const seq = String(existing + 1).padStart(4, '0');
  return `213RR-${incident.incidentNumber}-${seq}`;
}

// ─── CRUD ─────────────────────────────────────────────────────────────────────

export interface CreateRequestInput {
  incidentId: string;
  facilityId: string;
  requestedByUserId: string;
  priority?: RequestPriority;
  missionAssignment?: string;
  requestedForRole?: HicsRole;
  requestedForSection?: string;
  deliveryLocation?: string;
  deliveryBy?: Date | string;
  neededDate?: Date | string;
  justification?: string;
  lineItems: Array<{
    resourceTypeId?: string;
    resourceDescription: string;
    quantity: number;
    unit?: string;
    estimatedUnitCost?: number;
    notes?: string;
  }>;
}

export async function listRequests(incidentId: string, opts?: {
  status?: RequestStatus;
  facilityId?: string;
}) {
  return prisma.resourceRequest.findMany({
    where: {
      incidentId,
      isDeleted: false,
      ...(opts?.status ? { status: opts.status } : {}),
      ...(opts?.facilityId ? { facilityId: opts.facilityId } : {}),
    },
    include: {
      requestedByUser: { select: { id: true, firstName: true, lastName: true, email: true } },
      lineItems: {
        include: {
          resourceType: { select: { id: true, name: true, unit: true } },
          fulfillments: { select: { quantityFulfilled: true } },
        },
      },
    },
    orderBy: [{ priority: 'asc' }, { createdAt: 'desc' }],
  });
}

export async function getRequest(id: string) {
  const req = await prisma.resourceRequest.findFirst({
    where: { id, isDeleted: false },
    include: {
      requestedByUser: { select: { id: true, firstName: true, lastName: true, email: true } },
      lineItems: {
        include: {
          resourceType: true,
          fulfillments: {
            include: {
              incidentResource: { select: { id: true, name: true, status: true } },
            },
          },
        },
      },
    },
  });
  if (!req) throw new AppError('Resource request not found', 404);
  return req;
}

export async function createRequest(input: CreateRequestInput) {
  const requestNumber = await generateRequestNumber(input.incidentId);

  // Compute estimated cost from line items
  let estimatedTotal = new Decimal(0);
  for (const li of input.lineItems) {
    if (li.estimatedUnitCost != null) {
      estimatedTotal = estimatedTotal.plus(
        new Decimal(li.estimatedUnitCost).times(li.quantity),
      );
    }
  }

  const request = await prisma.resourceRequest.create({
    data: {
      requestNumber,
      incidentId: input.incidentId,
      facilityId: input.facilityId,
      requestedByUserId: input.requestedByUserId,
      priority: input.priority ?? 'ROUTINE',
      status: 'DRAFT',
      missionAssignment: input.missionAssignment ?? null,
      requestedForRole: input.requestedForRole ?? null,
      requestedForSection: input.requestedForSection ?? null,
      deliveryLocation: input.deliveryLocation ?? null,
      deliveryBy: input.deliveryBy ? new Date(input.deliveryBy) : null,
      neededDate: input.neededDate ? new Date(input.neededDate) : null,
      estimatedCost: estimatedTotal.gt(0) ? estimatedTotal.toFixed(4) : null,
      justification: input.justification ?? null,
      lineItems: {
        create: input.lineItems.map((li) => ({
          resourceTypeId: li.resourceTypeId ?? null,
          resourceDescription: li.resourceDescription,
          quantity: new Decimal(li.quantity).toFixed(2),
          unit: li.unit ?? 'each',
          estimatedUnitCost: li.estimatedUnitCost != null
            ? new Decimal(li.estimatedUnitCost).toFixed(4)
            : null,
          estimatedTotalCost: li.estimatedUnitCost != null
            ? new Decimal(li.estimatedUnitCost).times(li.quantity).toFixed(4)
            : null,
          notes: li.notes ?? null,
        })),
      },
    },
    include: { lineItems: true },
  });

  await writeAuditLog({
    actorUserId: input.requestedByUserId,
    facilityId: input.facilityId,
    incidentId: input.incidentId,
    action: 'REQUEST_CREATED',
    resourceType: 'ResourceRequest',
    resourceId: request.id,
    metadata: { requestNumber },
  });

  return request;
}

// ─── Workflow transitions ──────────────────────────────────────────────────────

export async function submitRequest(requestId: string, submittedByUserId: string) {
  const req = await prisma.resourceRequest.findFirst({
    where: { id: requestId, isDeleted: false },
    include: { lineItems: true, incident: { select: { id: true, facilityId: true } } },
  });
  if (!req) throw new AppError('Resource request not found', 404);
  if (!canTransitionRequest(req.status, 'SUBMITTED')) {
    throw new AppError(`Cannot submit a request in status ${req.status}`, 409);
  }
  if (req.lineItems.length === 0) {
    throw new AppError('Cannot submit a request with no line items', 422);
  }

  const updated = await prisma.resourceRequest.update({
    where: { id: requestId },
    data: {
      status: 'SUBMITTED',
      submittedAt: new Date(),
      submittedByUserId,
    },
  });

  emitToIncident(req.incident.id, SocketEvents.REQUEST_STATUS_CHANGED, {
    requestId, requestNumber: req.requestNumber, status: 'SUBMITTED',
  });

  await writeAuditLog({
    actorUserId: submittedByUserId,
    facilityId: req.incident.facilityId,
    incidentId: req.incident.id,
    action: 'REQUEST_SUBMITTED',
    resourceType: 'ResourceRequest',
    resourceId: requestId,
  });

  // Notify LOGISTICS_SECTION_CHIEF / SUPPLY_UNIT_LEADER for the incident
  await notifyLogisticsOfSubmission(req.incident.id, req.requestNumber, requestId);

  return updated;
}

export async function approveRequest(
  requestId: string,
  approvedByUserId: string,
  approvalNotes?: string,
) {
  const req = await _loadRequest(requestId);
  _assertTransition(req.status, 'APPROVED');

  const updated = await prisma.resourceRequest.update({
    where: { id: requestId },
    data: { status: 'APPROVED', approvedAt: new Date(), approvedByUserId, approvalNotes },
  });

  emitToIncident(req.incident.id, SocketEvents.REQUEST_STATUS_CHANGED, {
    requestId, requestNumber: req.requestNumber, status: 'APPROVED',
  });

  await writeAuditLog({
    actorUserId: approvedByUserId,
    facilityId: req.incident.facilityId,
    incidentId: req.incident.id,
    action: 'RESOURCE_APPROVED',
    resourceType: 'ResourceRequest',
    resourceId: requestId,
  });

  // Notify requester
  await createNotification({
    recipientUserId: req.requestedByUserId,
    incidentId: req.incident.id,
    type: 'REQUEST_APPROVED',
    title: 'Resource Request Approved',
    body: `Request ${req.requestNumber} has been approved.`,
    actionUrl: `/incidents/${req.incidentId}/resources/requests/${requestId}`,
  });

  return updated;
}

export async function denyRequest(
  requestId: string,
  deniedByUserId: string,
  denialReason: string,
) {
  if (!denialReason?.trim()) throw new AppError('Denial reason is required', 422);
  const req = await _loadRequest(requestId);
  _assertTransition(req.status, 'DENIED');

  const updated = await prisma.resourceRequest.update({
    where: { id: requestId },
    data: { status: 'DENIED', deniedAt: new Date(), deniedByUserId, denialReason },
  });

  emitToIncident(req.incident.id, SocketEvents.REQUEST_STATUS_CHANGED, {
    requestId, requestNumber: req.requestNumber, status: 'DENIED',
  });

  await writeAuditLog({
    actorUserId: deniedByUserId,
    facilityId: req.incident.facilityId,
    incidentId: req.incident.id,
    action: 'REQUEST_DENIED',
    resourceType: 'ResourceRequest',
    resourceId: requestId,
  });

  await createNotification({
    recipientUserId: req.requestedByUserId,
    incidentId: req.incident.id,
    type: 'REQUEST_DENIED',
    title: 'Resource Request Denied',
    body: `Request ${req.requestNumber} was denied: ${denialReason}`,
    actionUrl: `/incidents/${req.incidentId}/resources/requests/${requestId}`,
  });

  return updated;
}

export async function cancelRequest(
  requestId: string,
  cancelledByUserId: string,
) {
  const req = await _loadRequest(requestId);
  _assertTransition(req.status, 'CANCELLED');

  const updated = await prisma.resourceRequest.update({
    where: { id: requestId },
    data: { status: 'CANCELLED', cancelledAt: new Date(), cancelledByUserId },
  });

  await writeAuditLog({
    actorUserId: cancelledByUserId,
    facilityId: req.incident.facilityId,
    incidentId: req.incident.id,
    action: 'REQUEST_CANCELLED',
    resourceType: 'ResourceRequest',
    resourceId: requestId,
  });

  return updated;
}

// ─── Fulfillment ──────────────────────────────────────────────────────────────

export async function fulfillLineItem(opts: {
  lineItemId: string;
  incidentResourceId: string;
  quantityFulfilled: number;
  fulfilledByUserId: string;
  notes?: string;
}) {
  const lineItem = await prisma.resourceRequestLineItem.findUnique({
    where: { id: opts.lineItemId },
    include: { request: true },
  });
  if (!lineItem) throw new AppError('Line item not found', 404);
  if (!['APPROVED', 'PARTIALLY_FILLED'].includes(lineItem.request.status)) {
    throw new AppError('Can only fulfill line items on APPROVED or PARTIALLY_FILLED requests', 409);
  }

  const fulfillment = await prisma.requestFulfillment.create({
    data: {
      lineItemId: opts.lineItemId,
      incidentResourceId: opts.incidentResourceId,
      quantityFulfilled: new Decimal(opts.quantityFulfilled).toFixed(2),
      fulfilledByUserId: opts.fulfilledByUserId,
      notes: opts.notes ?? null,
    },
  });

  // Recalculate filled quantities for all line items and update request status
  await _recalculateFillStatus(lineItem.request.id, opts.fulfilledByUserId);

  return fulfillment;
}

async function _recalculateFillStatus(requestId: string, actorUserId: string) {
  const request = await prisma.resourceRequest.findUnique({
    where: { id: requestId },
    include: {
      lineItems: { include: { fulfillments: true } },
      incident: { select: { id: true, facilityId: true } },
    },
  });
  if (!request) return;

  let allFilled = true;
  let anyFilled = false;

  for (const li of request.lineItems) {
    const totalFilled = li.fulfillments.reduce(
      (sum, f) => sum.plus(f.quantityFulfilled.toString()),
      new Decimal(0),
    );

    // Update filledQuantity on the line item
    await prisma.resourceRequestLineItem.update({
      where: { id: li.id },
      data: { filledQuantity: totalFilled.toFixed(2) },
    });

    const needed = new Decimal(li.quantity.toString());
    if (totalFilled.lt(needed)) allFilled = false;
    if (totalFilled.gt(0)) anyFilled = true;
  }

  const newStatus: RequestStatus = allFilled ? 'FILLED' : anyFilled ? 'PARTIALLY_FILLED' : request.status;

  if (newStatus !== request.status) {
    await prisma.resourceRequest.update({
      where: { id: requestId },
      data: { status: newStatus },
    });

    emitToIncident(request.incident.id, SocketEvents.REQUEST_STATUS_CHANGED, {
      requestId, requestNumber: request.requestNumber, status: newStatus,
    });

    if (newStatus === 'FILLED') {
      await createNotification({
        recipientUserId: request.requestedByUserId,
        incidentId: request.incident.id,
        type: 'REQUEST_FULFILLED',
        title: 'Resource Request Fully Filled',
        body: `Request ${request.requestNumber} has been fully filled.`,
        actionUrl: `/incidents/${request.incidentId}/resources/requests/${requestId}`,
      });
    }
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function _loadRequest(requestId: string) {
  const req = await prisma.resourceRequest.findFirst({
    where: { id: requestId, isDeleted: false },
    include: {
      incident: { select: { id: true, facilityId: true } },
    },
  });
  if (!req) throw new AppError('Resource request not found', 404);
  return req;
}

function _assertTransition(from: RequestStatus, to: RequestStatus) {
  if (!canTransitionRequest(from, to)) {
    throw new AppError(
      `Invalid transition: ${from} → ${to}. Allowed: ${VALID_TRANSITIONS[from].join(', ') || 'none'}`,
      409,
    );
  }
}

async function notifyLogisticsOfSubmission(
  incidentId: string,
  requestNumber: string,
  requestId: string,
) {
  // Find users assigned to LOGISTICS_SECTION_CHIEF or SUPPLY_UNIT_LEADER on this incident
  const assignments = await prisma.incidentPositionAssignment.findMany({
    where: {
      incidentId,
      isActive: true,
      hicsRole: { in: ['LOGISTICS_SECTION_CHIEF', 'SUPPLY_UNIT_LEADER'] },
      assignedUserId: { not: null },
    },
    select: { assignedUserId: true },
  });

  await Promise.all(
    assignments
      .filter((a): a is typeof a & { assignedUserId: string } => a.assignedUserId != null)
      .map((a) =>
        createNotification({
          recipientUserId: a.assignedUserId,
          incidentId,
          type: 'REQUEST_SUBMITTED',
          title: 'New Resource Request Submitted',
          body: `Request ${requestNumber} has been submitted and awaits approval.`,
          actionUrl: `/incidents/${incidentId}/resources/requests/${requestId}`,
        }),
      ),
  );
}
