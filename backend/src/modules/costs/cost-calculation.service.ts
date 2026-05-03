/**
 * Cost Calculation Service
 *
 * POLICY: ALL currency arithmetic uses decimal.js — never native JS floats.
 *         Stored as NUMERIC(14,4) in PostgreSQL via Prisma Decimal type.
 *         All public APIs accept/return string representations of Decimal values.
 *
 * CAT_Z (FEMA Management Costs) is administratively capped at 5% of total
 * direct costs. This cap is enforced at the reporting layer but tracked here.
 */

import Decimal from 'decimal.js';
import { CostType, FemaPACategory } from '@prisma/client';
import { prisma } from '../../config/database';
import { AppError } from '../../utils/appError';
import { writeAuditLog } from '../../utils/audit';
import { emitToIncident, SocketEvents } from '../../socket';

// Configure Decimal.js for financial precision
Decimal.set({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

// FEMA CAT_Z management costs cap (5% of direct costs)
const FEMA_MGMT_CAP_PERCENT = new Decimal('0.05');

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CreateCostRecordInput {
  incidentId: string;
  operationalPeriodId?: string;
  costType: CostType;
  femaPACategory: FemaPACategory;
  description: string;
  quantity?: number | string;
  unitCost: number | string;
  vendor?: string;
  invoiceNumber?: string;
  documentationUrl?: string;
  incurredAt: Date | string;
  recordedByUserId: string;
  notes?: string;
  // Labor-specific
  labor?: {
    userId?: string;
    employeeId?: string;
    position?: string;
    regularHours: number;
    overtimeHours?: number;
    regularRate: number;
    overtimeRate?: number;
    benefits?: number;
    periodStart?: Date | string;
    periodEnd?: Date | string;
  };
  // Equipment-specific
  equipment?: {
    incidentResourceId?: string;
    equipmentType: string;
    equipmentIdentifier?: string;
    hours?: number;
    dailyRate?: number;
    mileage?: number;
    mileageRate?: number;
    operator?: string;
  };
}

// ─── Core CRUD ────────────────────────────────────────────────────────────────

export async function createCostRecord(input: CreateCostRecordInput) {
  const qty = new Decimal(input.quantity ?? 1);
  const unit = new Decimal(input.unitCost);
  const total = qty.times(unit);

  // For labor: override totalCost with calculated labor total
  let laborTotal = total;
  if (input.costType === 'LABOR' && input.labor) {
    const l = input.labor;
    const regPay = new Decimal(l.regularHours).times(new Decimal(l.regularRate));
    const otPay  = new Decimal(l.overtimeHours ?? 0).times(
      new Decimal(l.overtimeRate ?? new Decimal(l.regularRate).times('1.5').toFixed(4)),
    );
    const benefits = new Decimal(l.benefits ?? 0);
    laborTotal = regPay.plus(otPay).plus(benefits);
  }

  // For equipment: override totalCost with equipment total
  let equipTotal = total;
  if (input.costType === 'EQUIPMENT' && input.equipment) {
    const e = input.equipment;
    const hoursCost = new Decimal(e.hours ?? 0).times(new Decimal(e.dailyRate ?? 0));
    const mileageCost = new Decimal(e.mileage ?? 0).times(new Decimal(e.mileageRate ?? 0));
    equipTotal = hoursCost.plus(mileageCost);
    if (equipTotal.isZero()) equipTotal = total; // fall back to qty × unitCost
  }

  const finalTotal = input.costType === 'LABOR'
    ? laborTotal
    : input.costType === 'EQUIPMENT'
    ? equipTotal
    : total;

  const record = await prisma.costRecord.create({
    data: {
      incidentId: input.incidentId,
      operationalPeriodId: input.operationalPeriodId ?? null,
      costType: input.costType,
      femaPACategory: input.femaPACategory,
      description: input.description,
      quantity: qty.toFixed(3),
      unitCost: unit.toFixed(4),
      totalCost: finalTotal.toFixed(4),
      vendor: input.vendor ?? null,
      invoiceNumber: input.invoiceNumber ?? null,
      documentationUrl: input.documentationUrl ?? null,
      incurredAt: new Date(input.incurredAt),
      recordedByUserId: input.recordedByUserId,
      notes: input.notes ?? null,
    },
  });

  // Create sub-record for labor
  if (input.costType === 'LABOR' && input.labor) {
    const l = input.labor;
    await prisma.laborCostRecord.create({
      data: {
        costRecordId: record.id,
        userId: l.userId ?? null,
        employeeId: l.employeeId ?? null,
        position: l.position ?? null,
        regularHours: new Decimal(l.regularHours).toFixed(2),
        overtimeHours: new Decimal(l.overtimeHours ?? 0).toFixed(2),
        regularRate: new Decimal(l.regularRate).toFixed(4),
        overtimeRate: new Decimal(l.overtimeRate ?? new Decimal(l.regularRate).times('1.5')).toFixed(4),
        benefits: new Decimal(l.benefits ?? 0).toFixed(4),
        totalLaborCost: laborTotal.toFixed(4),
        periodStart: l.periodStart ? new Date(l.periodStart) : null,
        periodEnd: l.periodEnd ? new Date(l.periodEnd) : null,
      },
    });
  }

  // Create sub-record for equipment
  if (input.costType === 'EQUIPMENT' && input.equipment) {
    const e = input.equipment;
    await prisma.equipmentCostRecord.create({
      data: {
        costRecordId: record.id,
        incidentResourceId: e.incidentResourceId ?? null,
        equipmentType: e.equipmentType,
        equipmentIdentifier: e.equipmentIdentifier ?? null,
        hours: new Decimal(e.hours ?? 0).toFixed(2),
        dailyRate: new Decimal(e.dailyRate ?? 0).toFixed(4),
        mileage: new Decimal(e.mileage ?? 0).toFixed(2),
        mileageRate: new Decimal(e.mileageRate ?? 0).toFixed(4),
        totalEquipmentCost: equipTotal.toFixed(4),
        operator: e.operator ?? null,
      },
    });
  }

  await writeAuditLog({
    actorUserId: input.recordedByUserId,
    incidentId: input.incidentId,
    action: 'COST_RECORD_CREATED',
    resourceType: 'CostRecord',
    resourceId: record.id,
    metadata: { costType: input.costType, femaPACategory: input.femaPACategory, totalCost: finalTotal.toString() },
  });

  return record;
}

export async function listCostRecords(incidentId: string, opts?: {
  operationalPeriodId?: string;
  costType?: CostType;
  femaPACategory?: FemaPACategory;
  isApproved?: boolean;
}) {
  return prisma.costRecord.findMany({
    where: {
      incidentId,
      isDeleted: false,
      ...(opts?.operationalPeriodId ? { operationalPeriodId: opts.operationalPeriodId } : {}),
      ...(opts?.costType ? { costType: opts.costType } : {}),
      ...(opts?.femaPACategory ? { femaPACategory: opts.femaPACategory } : {}),
      ...(opts?.isApproved !== undefined ? { isApproved: opts.isApproved } : {}),
    },
    include: {
      laborCostRecord: { include: { user: { select: { id: true, firstName: true, lastName: true } } } },
      equipmentCostRecord: true,
      recordedByUser: { select: { id: true, firstName: true, lastName: true } },
    },
    orderBy: { incurredAt: 'desc' },
  });
}

export async function getCostRecord(id: string) {
  const record = await prisma.costRecord.findFirst({
    where: { id, isDeleted: false },
    include: {
      laborCostRecord: { include: { user: true } },
      equipmentCostRecord: { include: { incidentResource: true } },
      recordedByUser: { select: { id: true, firstName: true, lastName: true } },
      operationalPeriod: { select: { periodNumber: true } },
    },
  });
  if (!record) throw new AppError('Cost record not found', 404);
  return record;
}

export async function approveCostRecord(id: string, approvedByUserId: string) {
  const record = await prisma.costRecord.findFirst({ where: { id, isDeleted: false } });
  if (!record) throw new AppError('Cost record not found', 404);
  if (record.isApproved) throw new AppError('Cost record is already approved', 409);

  const updated = await prisma.costRecord.update({
    where: { id },
    data: { isApproved: true, approvedByUserId, approvedAt: new Date() },
  });

  await writeAuditLog({
    actorUserId: approvedByUserId,
    incidentId: record.incidentId,
    action: 'COST_RECORD_APPROVED',
    resourceType: 'CostRecord',
    resourceId: id,
    metadata: { totalCost: record.totalCost.toString() },
  });

  return updated;
}

export async function softDeleteCostRecord(id: string, deletedByUserId: string) {
  const record = await prisma.costRecord.findFirst({ where: { id, isDeleted: false } });
  if (!record) throw new AppError('Cost record not found', 404);
  if (record.isApproved) throw new AppError('Cannot delete an approved cost record', 409);

  return prisma.costRecord.update({
    where: { id },
    data: { isDeleted: true, deletedAt: new Date() },
  });
}

// ─── Rollup Computation ───────────────────────────────────────────────────────

/**
 * Compute and persist a CostRollup snapshot for an incident.
 * Called by the 15-minute cron job and on-demand via API.
 *
 * For each operational period AND for the incident total (operationalPeriodId = null).
 */
export async function computeCostRollup(incidentId: string): Promise<void> {
  const incident = await prisma.incident.findUnique({
    where: { id: incidentId },
    include: { operationalPeriods: { select: { id: true, periodNumber: true } } },
  });
  if (!incident) throw new AppError('Incident not found', 404);

  // Compute per-period rollups + total rollup
  for (const period of incident.operationalPeriods) {
    await _computePeriodRollup(incidentId, period.id);
  }
  await _computeIncidentTotalRollup(incidentId, incident.operationalPeriods);

  emitToIncident(incidentId, SocketEvents.COST_ROLLUP_UPDATED, { incidentId });

  await writeAuditLog({
    incidentId,
    action: 'COST_ROLLUP_COMPUTED',
    resourceType: 'Incident',
    resourceId: incidentId,
  });
}

async function _computePeriodRollup(incidentId: string, operationalPeriodId: string) {
  const records = await prisma.costRecord.findMany({
    where: { incidentId, operationalPeriodId, isDeleted: false },
    include: { laborCostRecord: true },
  });

  const agg = _aggregateRecords(records);

  // Upsert the rollup (one per period)
  await prisma.costRollup.upsert({
    where: { operationalPeriodId },
    update: { ...agg, computedAt: new Date() },
    create: { incidentId, operationalPeriodId, ...agg },
  });
}

async function _computeIncidentTotalRollup(
  incidentId: string,
  periods: Array<{ id: string; periodNumber: number }>,
) {
  const allRecords = await prisma.costRecord.findMany({
    where: { incidentId, isDeleted: false },
    include: { laborCostRecord: true },
  });

  // Build period-by-period array for trend chart
  const costByPeriod: Array<{ periodNumber: number; totalCost: string }> = [];
  for (const p of periods) {
    const periodRecords = allRecords.filter((r) => r.operationalPeriodId === p.id);
    const total = periodRecords.reduce((s, r) => s.plus(r.totalCost.toString()), new Decimal(0));
    costByPeriod.push({ periodNumber: p.periodNumber, totalCost: total.toFixed(4) });
  }

  const agg = _aggregateRecords(allRecords);

  // Incident-level rollup has operationalPeriodId = null
  // Since it's not @unique on null, we delete the previous total rollup and re-insert
  await prisma.costRollup.deleteMany({
    where: { incidentId, operationalPeriodId: null },
  });

  await prisma.costRollup.create({
    data: {
      incidentId,
      operationalPeriodId: null,
      costByPeriod,
      ...agg,
    },
  });
}

interface AggResult {
  totalCost: string;
  laborCost: string;
  equipmentCost: string;
  supplyCost: string;
  contractCost: string;
  overheadCost: string;
  costByFemaCategory: Record<string, string>;
  laborHours: string;
  equipmentHours: string;
  headcount: number;
  approvedCost: string;
  unapprovedCost: string;
  recordCount: number;
  costByPeriod: unknown[];
}

function _aggregateRecords(records: Awaited<ReturnType<typeof prisma.costRecord.findMany>>): AggResult {
  let totalCost      = new Decimal(0);
  let laborCost      = new Decimal(0);
  let equipmentCost  = new Decimal(0);
  let supplyCost     = new Decimal(0);
  let contractCost   = new Decimal(0);
  let overheadCost   = new Decimal(0);
  let laborHours     = new Decimal(0);
  let equipmentHours = new Decimal(0);
  let approvedCost   = new Decimal(0);
  let unapprovedCost = new Decimal(0);
  const headcountSet = new Set<string>();
  const byFema: Partial<Record<FemaPACategory, Decimal>> = {};

  for (const r of records) {
    const cost = new Decimal(r.totalCost.toString());
    totalCost = totalCost.plus(cost);

    switch (r.costType) {
      case 'LABOR':      laborCost     = laborCost.plus(cost); break;
      case 'EQUIPMENT':  equipmentCost = equipmentCost.plus(cost); break;
      case 'SUPPLY':     supplyCost    = supplyCost.plus(cost); break;
      case 'CONTRACT':   contractCost  = contractCost.plus(cost); break;
      case 'OVERHEAD':   overheadCost  = overheadCost.plus(cost); break;
    }

    byFema[r.femaPACategory] = (byFema[r.femaPACategory] ?? new Decimal(0)).plus(cost);

    if (r.isApproved) approvedCost   = approvedCost.plus(cost);
    else              unapprovedCost = unapprovedCost.plus(cost);

    // Labor hours + headcount
    if (r.costType === 'LABOR' && (r as any).laborCostRecord) {
      const lcr = (r as any).laborCostRecord;
      laborHours = laborHours
        .plus(new Decimal(lcr.regularHours.toString()))
        .plus(new Decimal(lcr.overtimeHours.toString()));
      if (lcr.userId) headcountSet.add(lcr.userId);
      else if (lcr.employeeId) headcountSet.add(`ext:${lcr.employeeId}`);
    }

    // Equipment hours
    if (r.costType === 'EQUIPMENT' && (r as any).equipmentCostRecord) {
      const ecr = (r as any).equipmentCostRecord;
      equipmentHours = equipmentHours.plus(new Decimal(ecr.hours.toString()));
    }
  }

  // Enforce CAT_Z 5% cap in the reporting display (note — does NOT modify records)
  const directCosts = totalCost.minus(byFema['CAT_Z'] ?? new Decimal(0));
  const catZCap = directCosts.times(FEMA_MGMT_CAP_PERCENT);
  const catZActual = byFema['CAT_Z'] ?? new Decimal(0);
  if (catZActual.gt(catZCap)) {
    byFema['CAT_Z'] = catZCap; // Display capped value
  }

  // Serialize byFema for JSON storage
  const costByFemaCategory: Record<string, string> = {};
  for (const [cat, val] of Object.entries(byFema)) {
    costByFemaCategory[cat] = (val as Decimal).toFixed(4);
  }

  return {
    totalCost:          totalCost.toFixed(4),
    laborCost:          laborCost.toFixed(4),
    equipmentCost:      equipmentCost.toFixed(4),
    supplyCost:         supplyCost.toFixed(4),
    contractCost:       contractCost.toFixed(4),
    overheadCost:       overheadCost.toFixed(4),
    costByFemaCategory,
    laborHours:         laborHours.toFixed(2),
    equipmentHours:     equipmentHours.toFixed(2),
    headcount:          headcountSet.size,
    approvedCost:       approvedCost.toFixed(4),
    unapprovedCost:     unapprovedCost.toFixed(4),
    recordCount:        records.length,
    costByPeriod:       [],  // set by caller for incident-level rollup
  };
}

/** Retrieve the most recent cost rollup(s) for an incident */
export async function getLatestRollup(incidentId: string, operationalPeriodId?: string) {
  if (operationalPeriodId) {
    return prisma.costRollup.findFirst({
      where: { incidentId, operationalPeriodId },
      orderBy: { computedAt: 'desc' },
    });
  }
  // Incident total
  return prisma.costRollup.findFirst({
    where: { incidentId, operationalPeriodId: null },
    orderBy: { computedAt: 'desc' },
  });
}
