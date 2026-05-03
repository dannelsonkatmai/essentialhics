import { prisma } from '../../config/database';
import type { AuthenticatedUser } from '../../types';

export interface CreateTemplateDto {
  name: string;
  description?: string;
  facilityId?: string;
  parentTemplateId?: string;
  formDefaults?: Array<{ formNumber: string; defaults: Record<string, unknown> }>;
}

// Deep merge helper (parent defaults ← child overrides)
function deepMerge(base: Record<string, unknown>, override: Record<string, unknown>): Record<string, unknown> {
  const result = { ...base };
  for (const key of Object.keys(override)) {
    const bv = base[key];
    const ov = override[key];
    if (
      ov !== null &&
      typeof ov === 'object' &&
      !Array.isArray(ov) &&
      bv !== null &&
      typeof bv === 'object' &&
      !Array.isArray(bv)
    ) {
      result[key] = deepMerge(bv as Record<string, unknown>, ov as Record<string, unknown>);
    } else {
      result[key] = ov;
    }
  }
  return result;
}

export async function listTemplates(facilityId: string | null, healthSystemId: string) {
  return prisma.iapTemplate.findMany({
    where: {
      isDeleted: false,
      isActive: true,
      OR: [
        { facilityId: facilityId ?? undefined },
        { facilityId: null, healthSystemId },
      ],
    },
    include: {
      _count: { select: { formDefaults: true } },
      parentTemplate: { select: { id: true, name: true } },
    },
    orderBy: { name: 'asc' },
  });
}

export async function getTemplate(id: string) {
  return prisma.iapTemplate.findUniqueOrThrow({
    where: { id, isDeleted: false },
    include: {
      formDefaults: true,
      parentTemplate: { include: { formDefaults: true } },
    },
  });
}

export async function createTemplate(dto: CreateTemplateDto, user: AuthenticatedUser) {
  const { formDefaults, ...rest } = dto;

  const template = await prisma.iapTemplate.create({
    data: {
      ...rest,
      healthSystemId: user.healthSystemId,
      createdById: user.id,
    },
  });

  if (formDefaults?.length) {
    await prisma.iapTemplateFormDefault.createMany({
      data: formDefaults.map((f) => ({
        templateId: template.id,
        formNumber: f.formNumber,
        defaults: f.defaults,
      })),
    });
  }

  return getTemplate(template.id);
}

export async function updateTemplate(
  id: string,
  dto: Partial<CreateTemplateDto>,
  user: AuthenticatedUser,
) {
  const { formDefaults, ...rest } = dto;

  await prisma.iapTemplate.update({ where: { id }, data: rest });

  if (formDefaults) {
    // Replace all form defaults
    await prisma.iapTemplateFormDefault.deleteMany({ where: { templateId: id } });
    if (formDefaults.length) {
      await prisma.iapTemplateFormDefault.createMany({
        data: formDefaults.map((f) => ({
          templateId: id,
          formNumber: f.formNumber,
          defaults: f.defaults,
        })),
      });
    }
  }

  return getTemplate(id);
}

export async function duplicateTemplate(id: string, newName: string, user: AuthenticatedUser) {
  const source = await getTemplate(id);

  const copy = await prisma.iapTemplate.create({
    data: {
      name: newName,
      description: source.description,
      facilityId: source.facilityId,
      healthSystemId: source.healthSystemId,
      parentTemplateId: source.parentTemplateId,
      createdById: user.id,
    },
  });

  if (source.formDefaults.length) {
    await prisma.iapTemplateFormDefault.createMany({
      data: source.formDefaults.map((f) => ({
        templateId: copy.id,
        formNumber: f.formNumber,
        defaults: f.defaults as Record<string, unknown>,
      })),
    });
  }

  return getTemplate(copy.id);
}

export async function deleteTemplate(id: string) {
  await prisma.iapTemplate.update({ where: { id }, data: { isDeleted: true, deletedAt: new Date() } });
}

/**
 * Returns resolved defaults for each form in the template, merging parent
 * defaults (base) with child overrides. Used by the IAP editor to pre-fill forms.
 */
export async function resolveTemplateDefaults(
  templateId: string,
): Promise<Record<string, Record<string, unknown>>> {
  const template = await getTemplate(templateId);

  // Build parent defaults map
  const parentDefaults: Record<string, Record<string, unknown>> = {};
  if (template.parentTemplate) {
    for (const fd of template.parentTemplate.formDefaults) {
      parentDefaults[fd.formNumber] = fd.defaults as Record<string, unknown>;
    }
  }

  // Merge child over parent
  const resolved: Record<string, Record<string, unknown>> = { ...parentDefaults };
  for (const fd of template.formDefaults) {
    const base = parentDefaults[fd.formNumber] ?? {};
    resolved[fd.formNumber] = deepMerge(base, fd.defaults as Record<string, unknown>);
  }

  return resolved;
}

// ── Objectives Bank ──────────────────────────────────────────────────────────

export async function listObjectives(healthSystemId: string, facilityId?: string) {
  return prisma.objectivesBank.findMany({
    where: {
      isDeleted: false,
      OR: [
        { healthSystemId, facilityId: facilityId ?? null },
        { healthSystemId, facilityId: null },
      ],
    },
    orderBy: [{ priority: 'asc' }, { usageCount: 'desc' }],
  });
}

export async function createObjective(
  dto: {
    objectiveText: string;
    priority: string;
    tags?: string[];
    facilityId?: string;
  },
  user: AuthenticatedUser,
) {
  return prisma.objectivesBank.create({
    data: {
      healthSystemId: user.healthSystemId,
      facilityId: dto.facilityId ?? null,
      objectiveText: dto.objectiveText,
      priority: dto.priority as any,
      tags: dto.tags ?? [],
      createdById: user.id,
    },
  });
}

export async function incrementObjectiveUsage(id: string) {
  await prisma.objectivesBank.update({
    where: { id },
    data: { usageCount: { increment: 1 } },
  });
}

// ── Tactics Bank ─────────────────────────────────────────────────────────────

export async function listTactics(healthSystemId: string, facilityId?: string) {
  return prisma.tacticsBank.findMany({
    where: {
      isDeleted: false,
      OR: [
        { healthSystemId, facilityId: facilityId ?? null },
        { healthSystemId, facilityId: null },
      ],
    },
    orderBy: { usageCount: 'desc' },
  });
}

export async function createTactic(
  dto: { tacticText: string; tags?: string[]; facilityId?: string },
  user: AuthenticatedUser,
) {
  return prisma.tacticsBank.create({
    data: {
      healthSystemId: user.healthSystemId,
      facilityId: dto.facilityId ?? null,
      tacticText: dto.tacticText,
      tags: dto.tags ?? [],
      createdById: user.id,
    },
  });
}

export async function incrementTacticUsage(id: string) {
  await prisma.tacticsBank.update({
    where: { id },
    data: { usageCount: { increment: 1 } },
  });
}
