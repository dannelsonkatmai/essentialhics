/**
 * Mutual Aid Agreement service
 */

import { prisma } from '../../config/database';
import { AppError } from '../../utils/appError';
import { writeAuditLog } from '../../utils/audit';

export interface CreateMutualAidInput {
  facilityId: string;
  healthSystemId: string;
  partnerOrganizationName: string;
  partnerContactName?: string;
  partnerContactPhone?: string;
  partnerContactEmail?: string;
  agreementType: string;
  agreementNumber?: string;
  effectiveDate?: Date | string;
  expirationDate?: Date | string;
  resourceCategories?: string[];
  terms?: string;
  createdBy: string;
}

export async function listMutualAidAgreements(facilityId: string) {
  return prisma.mutualAidAgreement.findMany({
    where: { facilityId },
    orderBy: [{ isActive: 'desc' }, { partnerOrganizationName: 'asc' }],
  });
}

export async function getMutualAidAgreement(id: string) {
  const ma = await prisma.mutualAidAgreement.findUnique({ where: { id } });
  if (!ma) throw new AppError('Mutual aid agreement not found', 404);
  return ma;
}

export async function createMutualAidAgreement(input: CreateMutualAidInput) {
  const ma = await prisma.mutualAidAgreement.create({
    data: {
      facilityId: input.facilityId,
      healthSystemId: input.healthSystemId,
      partnerOrganizationName: input.partnerOrganizationName,
      partnerContactName: input.partnerContactName ?? null,
      partnerContactPhone: input.partnerContactPhone ?? null,
      partnerContactEmail: input.partnerContactEmail ?? null,
      agreementType: input.agreementType,
      agreementNumber: input.agreementNumber ?? null,
      effectiveDate: input.effectiveDate ? new Date(input.effectiveDate) : null,
      expirationDate: input.expirationDate ? new Date(input.expirationDate) : null,
      resourceCategories: input.resourceCategories ?? [],
      terms: input.terms ?? null,
      createdBy: input.createdBy,
    },
  });

  await writeAuditLog({
    actorUserId: input.createdBy,
    facilityId: input.facilityId,
    action: 'MUTUAL_AID_AGREEMENT_CREATED',
    resourceType: 'MutualAidAgreement',
    resourceId: ma.id,
    metadata: { partnerOrganizationName: input.partnerOrganizationName },
  });

  return ma;
}

export async function updateMutualAidAgreement(id: string, updates: Partial<CreateMutualAidInput>) {
  const ma = await prisma.mutualAidAgreement.findUnique({ where: { id } });
  if (!ma) throw new AppError('Mutual aid agreement not found', 404);

  return prisma.mutualAidAgreement.update({
    where: { id },
    data: {
      ...(updates.partnerOrganizationName !== undefined ? { partnerOrganizationName: updates.partnerOrganizationName } : {}),
      ...(updates.partnerContactName !== undefined ? { partnerContactName: updates.partnerContactName } : {}),
      ...(updates.partnerContactPhone !== undefined ? { partnerContactPhone: updates.partnerContactPhone } : {}),
      ...(updates.partnerContactEmail !== undefined ? { partnerContactEmail: updates.partnerContactEmail } : {}),
      ...(updates.agreementType !== undefined ? { agreementType: updates.agreementType } : {}),
      ...(updates.agreementNumber !== undefined ? { agreementNumber: updates.agreementNumber } : {}),
      ...(updates.effectiveDate !== undefined ? { effectiveDate: updates.effectiveDate ? new Date(updates.effectiveDate) : null } : {}),
      ...(updates.expirationDate !== undefined ? { expirationDate: updates.expirationDate ? new Date(updates.expirationDate) : null } : {}),
      ...(updates.resourceCategories !== undefined ? { resourceCategories: updates.resourceCategories } : {}),
      ...(updates.terms !== undefined ? { terms: updates.terms } : {}),
      ...('isActive' in updates ? { isActive: (updates as any).isActive } : {}),
    },
  });
}

export { listMutualAidAgreements as list };
