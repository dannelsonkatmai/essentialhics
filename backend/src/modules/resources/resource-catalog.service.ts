/**
 * Resource Catalog — CRUD for ResourceType and FacilityResourceInventory
 */

import { NimsKind, ResourceCategory, CostUnitPeriod } from '@prisma/client';
import { Decimal } from 'decimal.js';
import { prisma } from '../../config/database';
import { AppError } from '../../utils/appError';

// ─── Resource Types ───────────────────────────────────────────────────────────

export interface CreateResourceTypeInput {
  facilityId?: string;
  healthSystemId: string;
  nimsKind: NimsKind;
  name: string;
  description?: string;
  unit: string;
  category: ResourceCategory;
  defaultCostPerUnit?: string | number;
  defaultCostUnitPeriod?: CostUnitPeriod;
  createdBy: string;
}

export async function listResourceTypes(opts: {
  healthSystemId: string;
  facilityId?: string;
  nimsKind?: NimsKind;
  category?: ResourceCategory;
  includeInactive?: boolean;
}) {
  return prisma.resourceType.findMany({
    where: {
      healthSystemId: opts.healthSystemId,
      ...(opts.facilityId
        ? { OR: [{ facilityId: opts.facilityId }, { facilityId: null }] }
        : {}),
      ...(opts.nimsKind ? { nimsKind: opts.nimsKind } : {}),
      ...(opts.category ? { category: opts.category } : {}),
      ...(!opts.includeInactive ? { isActive: true } : {}),
      isDeleted: false,
    },
    orderBy: [{ nimsKind: 'asc' }, { name: 'asc' }],
  });
}

export async function getResourceType(id: string) {
  const rt = await prisma.resourceType.findFirst({
    where: { id, isDeleted: false },
    include: { inventory: { select: { facilityId: true, quantityOnHand: true, quantityAvailable: true } } },
  });
  if (!rt) throw new AppError('Resource type not found', 404);
  return rt;
}

export async function createResourceType(input: CreateResourceTypeInput) {
  return prisma.resourceType.create({
    data: {
      facilityId: input.facilityId ?? null,
      healthSystemId: input.healthSystemId,
      nimsKind: input.nimsKind,
      name: input.name,
      description: input.description,
      unit: input.unit,
      category: input.category,
      defaultCostPerUnit: input.defaultCostPerUnit != null
        ? new Decimal(input.defaultCostPerUnit).toFixed(4)
        : null,
      defaultCostUnitPeriod: input.defaultCostUnitPeriod ?? null,
      createdBy: input.createdBy,
    },
  });
}

export async function updateResourceType(id: string, updates: Partial<CreateResourceTypeInput>) {
  const rt = await prisma.resourceType.findFirst({ where: { id, isDeleted: false } });
  if (!rt) throw new AppError('Resource type not found', 404);

  return prisma.resourceType.update({
    where: { id },
    data: {
      ...(updates.name !== undefined ? { name: updates.name } : {}),
      ...(updates.description !== undefined ? { description: updates.description } : {}),
      ...(updates.unit !== undefined ? { unit: updates.unit } : {}),
      ...(updates.category !== undefined ? { category: updates.category } : {}),
      ...(updates.defaultCostPerUnit != null
        ? { defaultCostPerUnit: new Decimal(updates.defaultCostPerUnit).toFixed(4) }
        : {}),
      ...(updates.defaultCostUnitPeriod !== undefined
        ? { defaultCostUnitPeriod: updates.defaultCostUnitPeriod }
        : {}),
    },
  });
}

export async function softDeleteResourceType(id: string) {
  const rt = await prisma.resourceType.findFirst({ where: { id, isDeleted: false } });
  if (!rt) throw new AppError('Resource type not found', 404);

  return prisma.resourceType.update({
    where: { id },
    data: { isDeleted: true, deletedAt: new Date() },
  });
}

// ─── Facility Inventory ───────────────────────────────────────────────────────

export async function getFacilityInventory(facilityId: string) {
  return prisma.facilityResourceInventory.findMany({
    where: { facilityId },
    include: { resourceType: true },
    orderBy: { resourceType: { name: 'asc' } },
  });
}

export async function upsertInventoryItem(opts: {
  facilityId: string;
  resourceTypeId: string;
  quantityOnHand: number;
  quantityAvailable: number;
  storageLocation?: string;
  notes?: string;
  lastUpdatedBy: string;
}) {
  const { facilityId, resourceTypeId, quantityOnHand, quantityAvailable, storageLocation, notes, lastUpdatedBy } = opts;

  return prisma.facilityResourceInventory.upsert({
    where: { facilityId_resourceTypeId: { facilityId, resourceTypeId } },
    update: {
      quantityOnHand: new Decimal(quantityOnHand).toFixed(2),
      quantityAvailable: new Decimal(quantityAvailable).toFixed(2),
      storageLocation,
      notes,
      lastUpdatedBy,
    },
    create: {
      facilityId,
      resourceTypeId,
      quantityOnHand: new Decimal(quantityOnHand).toFixed(2),
      quantityAvailable: new Decimal(quantityAvailable).toFixed(2),
      storageLocation,
      notes,
      lastUpdatedBy,
    },
  });
}
