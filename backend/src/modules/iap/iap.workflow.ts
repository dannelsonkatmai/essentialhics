import { IapStatus } from '@prisma/client';
import { prisma } from '../../config/database';
import { writeAuditLog } from '../../utils/audit';
import { calculateCompleteness } from './iap.completeness';
import { emitToIncident, SocketEvents } from '../../socket';
import type { AuthenticatedUser } from '../../types';

// Valid state transitions
const TRANSITIONS: Record<IapStatus, IapStatus[]> = {
  DRAFT: [IapStatus.IN_REVIEW],
  IN_REVIEW: [IapStatus.APPROVED, IapStatus.DRAFT],
  APPROVED: [IapStatus.PUBLISHED, IapStatus.DRAFT],
  PUBLISHED: [IapStatus.ARCHIVED],
  ARCHIVED: [],
};

export function canTransition(from: IapStatus, to: IapStatus): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false;
}

async function loadIapWithForms(iapId: string) {
  return prisma.iap.findUniqueOrThrow({
    where: { id: iapId },
    include: {
      operationalPeriod: {
        include: {
          incident: { select: { id: true, facilityId: true, healthSystemId: true } },
          iapForms201: { orderBy: { createdAt: 'desc' }, take: 1 },
          iapForms202: { orderBy: { createdAt: 'desc' }, take: 1 },
          iapForms203: { orderBy: { createdAt: 'desc' }, take: 1 },
          iapForms204: true,
          iapForms207: { orderBy: { createdAt: 'desc' }, take: 1 },
          iapForms215: { orderBy: { createdAt: 'desc' }, take: 1 },
          iapForms215a: { orderBy: { createdAt: 'desc' }, take: 1 },
          iapFormsHics251: { orderBy: { createdAt: 'desc' }, take: 1 },
          iapFormsHics252: { orderBy: { createdAt: 'desc' }, take: 1 },
        },
      },
    },
  });
}

async function refreshCompleteness(iapId: string): Promise<number> {
  const iap = await loadIapWithForms(iapId);
  const period = iap.operationalPeriod;

  const result = calculateCompleteness({
    form201: period.iapForms201[0]?.formData ?? null,
    form202: period.iapForms202[0]?.formData ?? null,
    form203: period.iapForms203[0]?.formData ?? null,
    form204: period.iapForms204.map((f) => f.formData as object),
    form207: period.iapForms207[0]?.formData ?? null,
    form215: period.iapForms215[0]?.formData ?? null,
    form215a: period.iapForms215a[0]?.formData ?? null,
    formHics251: period.iapFormsHics251[0]?.formData ?? null,
    formHics252: period.iapFormsHics252[0]?.formData ?? null,
  });

  await prisma.iap.update({
    where: { id: iapId },
    data: { completenessScore: result.overall, formCompleteness: result.perForm as any },
  });

  return result.overall;
}

export async function submitForReview(iapId: string, user: AuthenticatedUser): Promise<void> {
  const iap = await loadIapWithForms(iapId);

  if (!canTransition(iap.status, IapStatus.IN_REVIEW)) {
    throw Object.assign(
      new Error(`Cannot transition IAP from ${iap.status} to IN_REVIEW`),
      { statusCode: 409 },
    );
  }

  const period = iap.operationalPeriod;
  const result = calculateCompleteness({
    form201: period.iapForms201[0]?.formData ?? null,
    form202: period.iapForms202[0]?.formData ?? null,
    form203: period.iapForms203[0]?.formData ?? null,
    form204: period.iapForms204.map((f) => f.formData as object),
    form207: period.iapForms207[0]?.formData ?? null,
    form215: period.iapForms215[0]?.formData ?? null,
    form215a: period.iapForms215a[0]?.formData ?? null,
    formHics251: period.iapFormsHics251[0]?.formData ?? null,
    formHics252: period.iapFormsHics252[0]?.formData ?? null,
  });

  if (!result.canSubmit) {
    throw Object.assign(
      new Error(
        !result.ics202Complete
          ? 'ICS-202 must be 100% complete before submitting.'
          : `IAP completeness score (${result.overall}%) is below the minimum 60% required to submit.`,
      ),
      { statusCode: 422 },
    );
  }

  await prisma.iap.update({
    where: { id: iapId },
    data: {
      status: IapStatus.IN_REVIEW,
      submittedAt: new Date(),
      submittedById: user.id,
      completenessScore: result.overall,
      formCompleteness: result.perForm as any,
    },
  });

  const incident = period.incident;
  await writeAuditLog({
    userId: user.id,
    action: 'IAP_SUBMITTED',
    resourceType: 'Iap',
    resourceId: iapId,
    facilityId: incident.facilityId,
    healthSystemId: incident.healthSystemId,
  });

  emitToIncident(incident.id, SocketEvents.IAP_STATUS_CHANGED, {
    iapId,
    status: IapStatus.IN_REVIEW,
    completenessScore: result.overall,
  });
}

export async function approveIap(iapId: string, user: AuthenticatedUser): Promise<void> {
  const iap = await loadIapWithForms(iapId);

  if (!canTransition(iap.status, IapStatus.APPROVED)) {
    throw Object.assign(
      new Error(`Cannot transition IAP from ${iap.status} to APPROVED`),
      { statusCode: 409 },
    );
  }

  await prisma.iap.update({
    where: { id: iapId },
    data: { status: IapStatus.APPROVED, reviewedAt: new Date(), reviewedById: user.id },
  });

  const incident = iap.operationalPeriod.incident;
  await writeAuditLog({
    userId: user.id,
    action: 'IAP_SUBMITTED',
    resourceType: 'Iap',
    resourceId: iapId,
    facilityId: incident.facilityId,
    healthSystemId: incident.healthSystemId,
    newValues: { status: IapStatus.APPROVED },
  });

  emitToIncident(incident.id, SocketEvents.IAP_STATUS_CHANGED, { iapId, status: IapStatus.APPROVED });
}

export async function returnToDraft(iapId: string, notes: string, user: AuthenticatedUser): Promise<void> {
  const iap = await loadIapWithForms(iapId);

  if (!canTransition(iap.status, IapStatus.DRAFT)) {
    throw Object.assign(
      new Error(`Cannot return IAP to DRAFT from ${iap.status}`),
      { statusCode: 409 },
    );
  }

  await prisma.$transaction([
    prisma.iap.update({
      where: { id: iapId },
      data: { status: IapStatus.DRAFT, reviewedAt: new Date(), reviewedById: user.id },
    }),
    prisma.iapComment.create({
      data: {
        iapId,
        authorId: user.id,
        body: notes,
        isSystemMessage: true,
      },
    }),
  ]);

  const incident = iap.operationalPeriod.incident;
  await writeAuditLog({
    userId: user.id,
    action: 'IAP_RETURNED',
    resourceType: 'Iap',
    resourceId: iapId,
    facilityId: incident.facilityId,
    healthSystemId: incident.healthSystemId,
    newValues: { notes },
  });

  emitToIncident(incident.id, SocketEvents.IAP_STATUS_CHANGED, { iapId, status: IapStatus.DRAFT });
}

export async function publishIap(iapId: string, signatureData: string, user: AuthenticatedUser): Promise<void> {
  const iap = await loadIapWithForms(iapId);

  if (!canTransition(iap.status, IapStatus.PUBLISHED)) {
    throw Object.assign(
      new Error(`Cannot publish IAP from ${iap.status}`),
      { statusCode: 409 },
    );
  }

  const period = iap.operationalPeriod;

  // Capture e-signature on HICS-252
  const existing252 = period.iapFormsHics252[0];
  if (existing252) {
    await prisma.iapFormHics252.update({
      where: { id: existing252.id },
      data: {
        iapSignatureCaptured: true,
        iapSignatureData: signatureData,
        iapSignedAt: new Date(),
        iapSignedById: user.id,
        formData: {
          ...(existing252.formData as object),
          iapSignatureCaptured: true,
        },
      },
    });
  } else {
    await prisma.iapFormHics252.create({
      data: {
        operationalPeriodId: period.id,
        iapSignatureCaptured: true,
        iapSignatureData: signatureData,
        iapSignedAt: new Date(),
        iapSignedById: user.id,
        formData: { iapSignatureCaptured: true },
        lastEditedById: user.id,
      },
    });
  }

  await prisma.iap.update({
    where: { id: iapId },
    data: { status: IapStatus.PUBLISHED, approvedAt: new Date(), approvedById: user.id, publishedAt: new Date(), publishedById: user.id },
  });

  const incident = period.incident;
  await writeAuditLog({
    userId: user.id,
    action: 'IAP_SUBMITTED',
    resourceType: 'Iap',
    resourceId: iapId,
    facilityId: incident.facilityId,
    healthSystemId: incident.healthSystemId,
    newValues: { status: IapStatus.PUBLISHED },
  });

  emitToIncident(incident.id, SocketEvents.IAP_STATUS_CHANGED, { iapId, status: IapStatus.PUBLISHED });
}

export async function archiveIap(iapId: string, user: AuthenticatedUser): Promise<void> {
  const iap = await loadIapWithForms(iapId);

  if (!canTransition(iap.status, IapStatus.ARCHIVED)) {
    throw Object.assign(
      new Error(`Cannot archive IAP from ${iap.status}`),
      { statusCode: 409 },
    );
  }

  await prisma.iap.update({
    where: { id: iapId },
    data: { status: IapStatus.ARCHIVED },
  });

  const incident = iap.operationalPeriod.incident;
  await writeAuditLog({
    userId: user.id,
    action: 'IAP_ARCHIVED',
    resourceType: 'Iap',
    resourceId: iapId,
    facilityId: incident.facilityId,
    healthSystemId: incident.healthSystemId,
  });

  emitToIncident(incident.id, SocketEvents.IAP_STATUS_CHANGED, { iapId, status: IapStatus.ARCHIVED });
}

export { refreshCompleteness };
