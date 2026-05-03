import { prisma } from '../../config/database';
import { redis } from '../../config/redis';
import { emitToIncident, SocketEvents } from '../../socket';
import { refreshCompleteness } from './iap.workflow';
import type { AuthenticatedUser } from '../../types';

const IAP_CACHE_TTL = 30; // seconds

function iapCacheKey(iapId: string) {
  return `iap:cache:${iapId}`;
}

export async function getIap(iapId: string) {
  const cached = await redis.get(iapCacheKey(iapId));
  if (cached) return JSON.parse(cached);

  const iap = await prisma.iap.findUniqueOrThrow({
    where: { id: iapId },
    include: {
      operationalPeriod: {
        include: {
          incident: { select: { id: true, name: true, incidentNumber: true, facilityId: true } },
          iapForms201: { orderBy: { createdAt: 'desc' }, take: 1 },
          iapForms202: { orderBy: { createdAt: 'desc' }, take: 1 },
          iapForms203: { orderBy: { createdAt: 'desc' }, take: 1 },
          iapForms204: { orderBy: { createdAt: 'asc' } },
          iapForms207: { orderBy: { createdAt: 'desc' }, take: 1 },
          iapForms215: { orderBy: { createdAt: 'desc' }, take: 1 },
          iapForms215a: { orderBy: { createdAt: 'desc' }, take: 1 },
          iapFormsHics251: { orderBy: { createdAt: 'desc' }, take: 1 },
          iapFormsHics252: {
            orderBy: { createdAt: 'desc' },
            take: 1,
            select: {
              id: true, operationalPeriodId: true, iapSignatureCaptured: true,
              iapSignedAt: true, iapSignedById: true, formData: true, updatedAt: true,
              // iapSignatureData is intentionally excluded
            },
          },
        },
      },
      iapReviewAssignments: {
        where: { isActive: true },
        include: { reviewer: { select: { id: true, firstName: true, lastName: true, email: true } } },
      },
      comments: {
        orderBy: { createdAt: 'desc' },
        take: 20,
        include: { author: { select: { id: true, firstName: true, lastName: true } } },
      },
    },
  });

  await redis.setex(iapCacheKey(iapId), IAP_CACHE_TTL, JSON.stringify(iap));
  return iap;
}

export async function invalidateIapCache(iapId: string) {
  await redis.del(iapCacheKey(iapId));
}

// Generic form upsert used by auto-save (PATCH)
export async function saveForm(
  iapId: string,
  formNumber: string,
  formData: Record<string, unknown>,
  user: AuthenticatedUser,
) {
  const iap = await prisma.iap.findUniqueOrThrow({
    where: { id: iapId },
    include: { operationalPeriod: { include: { incident: true } } },
  });

  if (['PUBLISHED', 'ARCHIVED'].includes(iap.status)) {
    throw Object.assign(new Error('Cannot edit a published or archived IAP.'), { statusCode: 409 });
  }

  const periodId = iap.operationalPeriodId;
  const incidentId = iap.operationalPeriod.incidentId;
  const facilityId = iap.operationalPeriod.incident.facilityId;

  let result: any;

  switch (formNumber) {
    case '201':
      result = await upsertSingleForm('iapForm201', { operationalPeriodId: periodId }, formData, user);
      break;
    case '202':
      result = await upsertSingleForm('iapForm202', { operationalPeriodId: periodId }, formData, user);
      break;
    case '203':
      result = await upsertSingleForm('iapForm203', { operationalPeriodId: periodId }, formData, user);
      break;
    case '207':
      result = await upsertSingleForm('iapForm207', { operationalPeriodId: periodId }, formData, user);
      break;
    case '215':
      result = await upsertSingleForm('iapForm215', { operationalPeriodId: periodId }, formData, user);
      break;
    case '215a':
      result = await upsertSingleForm('iapForm215a', { operationalPeriodId: periodId }, formData, user);
      break;
    case 'hics251':
      result = await upsertSingleForm('iapFormHics251', { operationalPeriodId: periodId }, formData, user);
      break;
    case 'hics252':
      // Handled separately — signature captured via workflow
      result = await upsertSingleForm('iapFormHics252', { operationalPeriodId: periodId }, formData, user);
      break;
    default:
      throw Object.assign(new Error(`Unknown form number: ${formNumber}`), { statusCode: 400 });
  }

  await invalidateIapCache(iapId);
  const score = await refreshCompleteness(iapId);

  emitToIncident(incidentId, SocketEvents.IAP_FORM_SAVED, {
    iapId, formNumber, savedBy: user.id, completenessScore: score,
  });

  return { form: result, completenessScore: score };
}

async function upsertSingleForm(
  model: string,
  where: Record<string, string>,
  formData: Record<string, unknown>,
  user: AuthenticatedUser,
) {
  const prismaModel = (prisma as any)[model];
  const existing = await prismaModel.findFirst({ where });

  if (existing) {
    return prismaModel.update({
      where: { id: existing.id },
      data: { formData, lastEditedById: user.id, updatedAt: new Date() },
    });
  }

  return prismaModel.create({
    data: { ...where, formData, lastEditedById: user.id },
  });
}

// ICS-204: multiple per period
export async function saveForm204(
  iapId: string,
  branchName: string,
  divisionGroupName: string,
  formData: Record<string, unknown>,
  user: AuthenticatedUser,
  form204Id?: string,
) {
  const iap = await prisma.iap.findUniqueOrThrow({
    where: { id: iapId },
    include: { operationalPeriod: { include: { incident: true } } },
  });

  if (['PUBLISHED', 'ARCHIVED'].includes(iap.status)) {
    throw Object.assign(new Error('Cannot edit a published or archived IAP.'), { statusCode: 409 });
  }

  const periodId = iap.operationalPeriodId;
  let form;

  if (form204Id) {
    form = await prisma.iapForm204.update({
      where: { id: form204Id },
      data: { formData, branchName, divisionGroupName, lastEditedById: user.id },
    });
  } else {
    form = await prisma.iapForm204.create({
      data: { operationalPeriodId: periodId, branchName, divisionGroupName, formData, lastEditedById: user.id },
    });
  }

  await invalidateIapCache(iapId);
  const score = await refreshCompleteness(iapId);
  return { form, completenessScore: score };
}

// ICS-213: incident-scoped message log (POST to create)
export async function createForm213(
  incidentId: string,
  formData: Record<string, unknown>,
  user: AuthenticatedUser,
) {
  return prisma.iapForm213.create({
    data: { incidentId, formData, createdById: user.id },
  });
}

export async function listForm213(incidentId: string, page = 1, limit = 50) {
  const [total, records] = await Promise.all([
    prisma.iapForm213.count({ where: { incidentId } }),
    prisma.iapForm213.findMany({
      where: { incidentId },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
  ]);
  return { data: records, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
}

// Review assignments
export async function assignReviewer(iapId: string, reviewerUserId: string, user: AuthenticatedUser) {
  // Deactivate existing assignments for this reviewer
  await prisma.iapReviewAssignment.updateMany({
    where: { iapId, reviewerId: reviewerUserId },
    data: { isActive: false },
  });

  return prisma.iapReviewAssignment.create({
    data: { iapId, reviewerId: reviewerUserId, assignedById: user.id },
    include: { reviewer: { select: { id: true, firstName: true, lastName: true, email: true } } },
  });
}

// Comments
export async function addComment(
  iapId: string,
  body: string,
  formReference: string | null,
  parentId: string | null,
  user: AuthenticatedUser,
) {
  return prisma.iapComment.create({
    data: { iapId, authorId: user.id, body, formReference, parentId },
    include: { author: { select: { id: true, firstName: true, lastName: true } } },
  });
}

export async function resolveComment(commentId: string, user: AuthenticatedUser) {
  return prisma.iapComment.update({
    where: { id: commentId },
    data: { isResolved: true, resolvedById: user.id, resolvedAt: new Date() },
  });
}
