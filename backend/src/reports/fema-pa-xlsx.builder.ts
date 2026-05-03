/**
 * FEMA Public Assistance XLSX Report Builder
 *
 * Generates a 9-sheet Excel workbook using ExcelJS:
 *   1. Summary — incident info + cost totals by FEMA PA category
 *   2. Labor     — all LABOR cost records with employee detail
 *   3. Equipment — all EQUIPMENT cost records with asset detail
 *   4. Supplies  — all SUPPLY cost records
 *   5. Contracts — all CONTRACT cost records
 *   6. Overhead  — all OVERHEAD cost records + CAT_Z cap notice
 *   7. Resources — IncidentResource manifest with status + cost
 *   8. MutualAid — mutual aid agreements + resource activations
 *   9. Timeline  — cost-by-period trend data
 *
 * All monetary values use decimal.js internally and are formatted as
 * US-dollar strings in the output cells (Excel Number format: $#,##0.00).
 */

import ExcelJS from 'exceljs';
import Decimal from 'decimal.js';
import { FemaPACategory } from '@prisma/client';
import { prisma } from '../config/database';
import { AppError } from '../utils/appError';

// ─── FEMA Category metadata ───────────────────────────────────────────────────

const FEMA_CATEGORY_LABELS: Record<FemaPACategory, string> = {
  CAT_A: 'A — Debris Removal',
  CAT_B: 'B — Emergency Protective Measures',
  CAT_C: 'C — Roads & Bridges',
  CAT_D: 'D — Water Control Facilities',
  CAT_E: 'E — Buildings & Equipment',
  CAT_F: 'F — Utilities',
  CAT_G: 'G — Parks, Recreational & Other',
  CAT_Z: 'Z — Management Costs (≤5%)',
};

// ─── Styles ───────────────────────────────────────────────────────────────────

const HEADER_FILL: ExcelJS.Fill = {
  type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1B3A6B' },
};
const HEADER_FONT: Partial<ExcelJS.Font> = { color: { argb: 'FFFFFFFF' }, bold: true, size: 10 };
const MONEY_FORMAT = '$#,##0.00';
const DATE_FORMAT  = 'mm/dd/yyyy';
const DATETIME_FORMAT = 'mm/dd/yyyy hh:mm';

function styleHeader(row: ExcelJS.Row) {
  row.eachCell((cell) => {
    cell.fill = HEADER_FILL;
    cell.font = HEADER_FONT;
    cell.alignment = { vertical: 'middle', wrapText: true };
    cell.border = { bottom: { style: 'thin', color: { argb: 'FFFFFFFF' } } };
  });
  row.height = 22;
}

function addTitle(ws: ExcelJS.Worksheet, title: string) {
  const row = ws.addRow([title]);
  row.getCell(1).font = { bold: true, size: 14, color: { argb: 'FF1B3A6B' } };
  ws.addRow([]);
}

function moneyCell(ws: ExcelJS.Worksheet, row: ExcelJS.Row, col: number, value: Decimal | string | number) {
  const cell = row.getCell(col);
  cell.value = new Decimal(value.toString()).toNumber();
  cell.numFmt = MONEY_FORMAT;
}

// ─── Main builder function ────────────────────────────────────────────────────

export interface FemaPAReportOptions {
  incidentId: string;
  /** Optional filter: include only approved records */
  approvedOnly?: boolean;
  /** Optional operational period filter */
  operationalPeriodId?: string;
}

export async function buildFemaPaXlsx(opts: FemaPAReportOptions): Promise<Buffer> {
  const { incidentId, approvedOnly = false } = opts;

  // ── Load data ──────────────────────────────────────────────────────────────
  const incident = await prisma.incident.findUnique({
    where: { id: incidentId },
    include: {
      facility: { select: { name: true, address: true, licenseNumber: true } },
      operationalPeriods: { orderBy: { periodNumber: 'asc' } },
    },
  });
  if (!incident) throw new AppError('Incident not found', 404);

  const costRecords = await prisma.costRecord.findMany({
    where: {
      incidentId,
      isDeleted: false,
      ...(approvedOnly ? { isApproved: true } : {}),
      ...(opts.operationalPeriodId ? { operationalPeriodId: opts.operationalPeriodId } : {}),
    },
    include: {
      laborCostRecord: { include: { user: { select: { firstName: true, lastName: true, email: true } } } },
      equipmentCostRecord: { include: { incidentResource: { select: { name: true, resourceIdentifier: true } } } },
      recordedByUser: { select: { firstName: true, lastName: true } },
      operationalPeriod: { select: { periodNumber: true } },
    },
    orderBy: { incurredAt: 'asc' },
  });

  const resources = await prisma.incidentResource.findMany({
    where: { incidentId, isDeleted: false },
    include: { resourceType: { select: { name: true, category: true } } },
    orderBy: [{ status: 'asc' }, { name: 'asc' }],
  });

  const mutualAidResources = resources.filter((r) => r.source === 'MUTUAL_AID');
  const agreements = await prisma.mutualAidAgreement.findMany({
    where: { facilityId: incident.facilityId },
  });

  // ── Build rollup totals ────────────────────────────────────────────────────
  const totals: Record<string, Decimal> = {
    TOTAL: new Decimal(0), LABOR: new Decimal(0), EQUIPMENT: new Decimal(0),
    SUPPLY: new Decimal(0), CONTRACT: new Decimal(0), OVERHEAD: new Decimal(0),
  };
  const byFema: Partial<Record<FemaPACategory, Decimal>> = {};
  const approvedTotal = new Decimal(0);

  for (const r of costRecords) {
    const cost = new Decimal(r.totalCost.toString());
    totals['TOTAL'] = totals['TOTAL'].plus(cost);
    totals[r.costType] = totals[r.costType].plus(cost);
    byFema[r.femaPACategory] = (byFema[r.femaPACategory] ?? new Decimal(0)).plus(cost);
  }

  // ── Create workbook ────────────────────────────────────────────────────────
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Essential HICS';
  wb.created = new Date();

  // ══════════════════════════════════════════════════════════
  // Sheet 1: Summary
  // ══════════════════════════════════════════════════════════
  const wsSummary = wb.addWorksheet('Summary', { properties: { tabColor: { argb: 'FF1B3A6B' } } });
  wsSummary.columns = [
    { width: 36 }, { width: 30 }, { width: 20 }, { width: 20 },
  ];

  addTitle(wsSummary, 'FEMA Public Assistance — Cost Documentation');
  wsSummary.addRow(['Incident Name:', incident.name]);
  wsSummary.addRow(['Incident Number:', incident.incidentNumber]);
  wsSummary.addRow(['Facility:', incident.facility.name]);
  wsSummary.addRow(['Declaration Date:', incident.declarationTime.toLocaleDateString('en-US')]);
  wsSummary.addRow(['Report Generated:', new Date().toLocaleString('en-US')]);
  wsSummary.addRow([approvedOnly ? 'Scope: Approved costs only' : 'Scope: All recorded costs']);
  wsSummary.addRow([]);

  // Cost by type
  const typeHeader = wsSummary.addRow(['Cost Type', 'Amount', '% of Total']);
  styleHeader(typeHeader);
  for (const [type, dec] of Object.entries(totals)) {
    if (type === 'TOTAL') continue;
    const pct = totals['TOTAL'].gt(0) ? dec.div(totals['TOTAL']).times(100).toFixed(1) : '0.0';
    const row = wsSummary.addRow([type, null, `${pct}%`]);
    moneyCell(wsSummary, row, 2, dec);
  }
  const totalRow = wsSummary.addRow(['TOTAL', null]);
  moneyCell(wsSummary, totalRow, 2, totals['TOTAL']);
  totalRow.getCell(1).font = { bold: true };
  totalRow.getCell(2).font = { bold: true };

  wsSummary.addRow([]);
  const catHeader = wsSummary.addRow(['FEMA PA Category', 'Amount', 'Eligible?']);
  styleHeader(catHeader);
  for (const [cat, dec] of Object.entries(byFema) as [FemaPACategory, Decimal][]) {
    const row = wsSummary.addRow([FEMA_CATEGORY_LABELS[cat], null, '']);
    moneyCell(wsSummary, row, 2, dec);
  }

  // CAT_Z 5% cap advisory
  const directCosts = totals['TOTAL'].minus(byFema['CAT_Z'] ?? new Decimal(0));
  const catZCap = directCosts.times('0.05');
  const catZActual = byFema['CAT_Z'] ?? new Decimal(0);
  if (catZActual.gt(catZCap)) {
    const warningRow = wsSummary.addRow([
      `⚠ CAT_Z exceeds 5% cap. Eligible amount: $${catZCap.toFixed(2)} (actual: $${catZActual.toFixed(2)})`,
    ]);
    warningRow.getCell(1).font = { bold: true, color: { argb: 'FFCC0000' } };
  }

  // ══════════════════════════════════════════════════════════
  // Sheet 2: Labor
  // ══════════════════════════════════════════════════════════
  const wsLabor = wb.addWorksheet('Labor');
  wsLabor.columns = [
    { header: 'Record ID', key: 'id', width: 12 },
    { header: 'Date', key: 'date', width: 14 },
    { header: 'Employee Name', key: 'name', width: 24 },
    { header: 'Employee ID', key: 'empId', width: 14 },
    { header: 'Position', key: 'position', width: 22 },
    { header: 'Reg Hours', key: 'regHrs', width: 12 },
    { header: 'OT Hours', key: 'otHrs', width: 12 },
    { header: 'Reg Rate ($/hr)', key: 'regRate', width: 16 },
    { header: 'OT Rate ($/hr)', key: 'otRate', width: 16 },
    { header: 'Benefits', key: 'benefits', width: 14 },
    { header: 'Total Labor Cost', key: 'total', width: 18 },
    { header: 'FEMA Category', key: 'fema', width: 16 },
    { header: 'Op Period', key: 'period', width: 12 },
    { header: 'Approved', key: 'approved', width: 12 },
  ];
  styleHeader(wsLabor.getRow(1));

  const laborRecords = costRecords.filter((r) => r.costType === 'LABOR');
  for (const r of laborRecords) {
    const lcr = r.laborCostRecord;
    const row = wsLabor.addRow({
      id:       r.id.slice(0, 8),
      date:     r.incurredAt,
      name:     lcr
        ? `${lcr.user?.firstName ?? ''} ${lcr.user?.lastName ?? ''}`.trim() || lcr.employeeId || 'Unknown'
        : '',
      empId:    lcr?.employeeId ?? '',
      position: lcr?.position ?? '',
      regHrs:   lcr ? new Decimal(lcr.regularHours.toString()).toNumber() : 0,
      otHrs:    lcr ? new Decimal(lcr.overtimeHours.toString()).toNumber() : 0,
      regRate:  lcr ? new Decimal(lcr.regularRate.toString()).toNumber() : 0,
      otRate:   lcr ? new Decimal(lcr.overtimeRate.toString()).toNumber() : 0,
      benefits: lcr ? new Decimal(lcr.benefits.toString()).toNumber() : 0,
      total:    new Decimal(r.totalCost.toString()).toNumber(),
      fema:     r.femaPACategory,
      period:   r.operationalPeriod?.periodNumber ?? '',
      approved: r.isApproved ? 'Yes' : 'No',
    });
    row.getCell('date').numFmt = DATE_FORMAT;
    row.getCell('regRate').numFmt = MONEY_FORMAT;
    row.getCell('otRate').numFmt = MONEY_FORMAT;
    row.getCell('benefits').numFmt = MONEY_FORMAT;
    row.getCell('total').numFmt = MONEY_FORMAT;
  }

  // ══════════════════════════════════════════════════════════
  // Sheet 3: Equipment
  // ══════════════════════════════════════════════════════════
  const wsEquip = wb.addWorksheet('Equipment');
  wsEquip.columns = [
    { header: 'Record ID', key: 'id', width: 12 },
    { header: 'Date', key: 'date', width: 14 },
    { header: 'Equipment Type', key: 'type', width: 26 },
    { header: 'Identifier', key: 'identifier', width: 18 },
    { header: 'Operator', key: 'operator', width: 20 },
    { header: 'Hours Used', key: 'hours', width: 14 },
    { header: 'Daily Rate', key: 'dailyRate', width: 14 },
    { header: 'Mileage', key: 'mileage', width: 12 },
    { header: 'Mileage Rate', key: 'mileageRate', width: 14 },
    { header: 'Total Cost', key: 'total', width: 16 },
    { header: 'FEMA Category', key: 'fema', width: 16 },
    { header: 'Op Period', key: 'period', width: 12 },
    { header: 'Approved', key: 'approved', width: 12 },
  ];
  styleHeader(wsEquip.getRow(1));

  const equipRecords = costRecords.filter((r) => r.costType === 'EQUIPMENT');
  for (const r of equipRecords) {
    const ecr = r.equipmentCostRecord;
    const row = wsEquip.addRow({
      id:          r.id.slice(0, 8),
      date:        r.incurredAt,
      type:        ecr?.equipmentType ?? r.description,
      identifier:  ecr?.equipmentIdentifier ?? '',
      operator:    ecr?.operator ?? '',
      hours:       ecr ? new Decimal(ecr.hours.toString()).toNumber() : 0,
      dailyRate:   ecr ? new Decimal(ecr.dailyRate.toString()).toNumber() : 0,
      mileage:     ecr ? new Decimal(ecr.mileage.toString()).toNumber() : 0,
      mileageRate: ecr ? new Decimal(ecr.mileageRate.toString()).toNumber() : 0,
      total:       new Decimal(r.totalCost.toString()).toNumber(),
      fema:        r.femaPACategory,
      period:      r.operationalPeriod?.periodNumber ?? '',
      approved:    r.isApproved ? 'Yes' : 'No',
    });
    row.getCell('date').numFmt = DATE_FORMAT;
    row.getCell('dailyRate').numFmt = MONEY_FORMAT;
    row.getCell('mileageRate').numFmt = MONEY_FORMAT;
    row.getCell('total').numFmt = MONEY_FORMAT;
  }

  // ══════════════════════════════════════════════════════════
  // Sheet 4: Supplies  |  5: Contracts  |  6: Overhead
  // ══════════════════════════════════════════════════════════
  const genericSheets: Array<{ name: string; type: string }> = [
    { name: 'Supplies', type: 'SUPPLY' },
    { name: 'Contracts', type: 'CONTRACT' },
    { name: 'Overhead', type: 'OVERHEAD' },
  ];

  for (const { name, type } of genericSheets) {
    const ws = wb.addWorksheet(name);
    ws.columns = [
      { header: 'Record ID', key: 'id', width: 12 },
      { header: 'Date', key: 'date', width: 14 },
      { header: 'Description', key: 'desc', width: 40 },
      { header: 'Vendor', key: 'vendor', width: 26 },
      { header: 'Invoice #', key: 'invoice', width: 16 },
      { header: 'Quantity', key: 'qty', width: 12 },
      { header: 'Unit Cost', key: 'unitCost', width: 14 },
      { header: 'Total Cost', key: 'total', width: 16 },
      { header: 'FEMA Category', key: 'fema', width: 16 },
      { header: 'Op Period', key: 'period', width: 12 },
      { header: 'Approved', key: 'approved', width: 12 },
    ];
    styleHeader(ws.getRow(1));

    for (const r of costRecords.filter((c) => c.costType === type)) {
      const row = ws.addRow({
        id:       r.id.slice(0, 8),
        date:     r.incurredAt,
        desc:     r.description,
        vendor:   r.vendor ?? '',
        invoice:  r.invoiceNumber ?? '',
        qty:      new Decimal(r.quantity.toString()).toNumber(),
        unitCost: new Decimal(r.unitCost.toString()).toNumber(),
        total:    new Decimal(r.totalCost.toString()).toNumber(),
        fema:     r.femaPACategory,
        period:   r.operationalPeriod?.periodNumber ?? '',
        approved: r.isApproved ? 'Yes' : 'No',
      });
      row.getCell('date').numFmt = DATE_FORMAT;
      row.getCell('unitCost').numFmt = MONEY_FORMAT;
      row.getCell('total').numFmt = MONEY_FORMAT;
    }

    // CAT_Z cap advisory on Overhead sheet
    if (type === 'OVERHEAD') {
      ws.addRow([]);
      if (catZActual.gt(catZCap)) {
        const advisory = ws.addRow([
          `Advisory: CAT_Z Management Costs exceed the 5% cap. ` +
          `Actual: $${catZActual.toFixed(2)} | Cap: $${catZCap.toFixed(2)} | ` +
          `Direct Costs Base: $${directCosts.toFixed(2)}`,
        ]);
        advisory.getCell(1).font = { bold: true, color: { argb: 'FFCC0000' } };
      }
    }
  }

  // ══════════════════════════════════════════════════════════
  // Sheet 7: Resources
  // ══════════════════════════════════════════════════════════
  const wsRes = wb.addWorksheet('Resources');
  wsRes.columns = [
    { header: 'Resource Name', key: 'name', width: 30 },
    { header: 'NIMS Kind', key: 'kind', width: 14 },
    { header: 'Category', key: 'cat', width: 14 },
    { header: 'Source', key: 'source', width: 14 },
    { header: 'Status', key: 'status', width: 16 },
    { header: 'Identifier', key: 'id', width: 18 },
    { header: 'Home Org', key: 'homeOrg', width: 26 },
    { header: 'Qty', key: 'qty', width: 8 },
    { header: 'Unit', key: 'unit', width: 10 },
    { header: 'Cost/Unit', key: 'costUnit', width: 14 },
    { header: 'Unit Period', key: 'unitPeriod', width: 12 },
    { header: 'Ordered At', key: 'ordered', width: 18 },
    { header: 'Demob At', key: 'demob', width: 18 },
  ];
  styleHeader(wsRes.getRow(1));

  for (const r of resources) {
    const row = wsRes.addRow({
      name:       r.name,
      kind:       r.nimsKind,
      cat:        r.resourceType?.category ?? '',
      source:     r.source,
      status:     r.status,
      id:         r.resourceIdentifier ?? '',
      homeOrg:    r.homeBaseOrgName ?? '',
      qty:        new Decimal(r.quantity.toString()).toNumber(),
      unit:       r.unit,
      costUnit:   r.costPerUnit ? new Decimal(r.costPerUnit.toString()).toNumber() : '',
      unitPeriod: r.costUnitPeriod ?? '',
      ordered:    r.orderedAt,
      demob:      r.demobilizedAt,
    });
    if (r.orderedAt) row.getCell('ordered').numFmt = DATETIME_FORMAT;
    if (r.demobilizedAt) row.getCell('demob').numFmt = DATETIME_FORMAT;
    if (r.costPerUnit) row.getCell('costUnit').numFmt = MONEY_FORMAT;
  }

  // ══════════════════════════════════════════════════════════
  // Sheet 8: Mutual Aid
  // ══════════════════════════════════════════════════════════
  const wsMa = wb.addWorksheet('Mutual Aid');
  wsMa.columns = [
    { header: 'Partner Organization', key: 'org', width: 34 },
    { header: 'Agreement Number', key: 'agreementNum', width: 20 },
    { header: 'Agreement Type', key: 'type', width: 20 },
    { header: 'Contact Name', key: 'contact', width: 22 },
    { header: 'Contact Phone', key: 'phone', width: 18 },
    { header: 'Effective Date', key: 'effective', width: 16 },
    { header: 'Expiration Date', key: 'expires', width: 16 },
  ];
  styleHeader(wsMa.getRow(1));
  for (const a of agreements) {
    const row = wsMa.addRow({
      org:          a.partnerOrganizationName,
      agreementNum: a.agreementNumber ?? '',
      type:         a.agreementType,
      contact:      a.partnerContactName ?? '',
      phone:        a.partnerContactPhone ?? '',
      effective:    a.effectiveDate,
      expires:      a.expirationDate,
    });
    if (a.effectiveDate) row.getCell('effective').numFmt = DATE_FORMAT;
    if (a.expirationDate) row.getCell('expires').numFmt = DATE_FORMAT;
  }

  if (mutualAidResources.length > 0) {
    wsMa.addRow([]);
    const maResHeader = wsMa.addRow(['Mutual Aid Resources Activated on This Incident']);
    maResHeader.getCell(1).font = { bold: true };
    const maResColHeader = wsMa.addRow(['Resource Name', 'Home Org', 'Status', 'Ordered At', 'Demob At']);
    styleHeader(maResColHeader);
    for (const r of mutualAidResources) {
      const row = wsMa.addRow([
        r.name, r.homeBaseOrgName ?? '', r.status, r.orderedAt, r.demobilizedAt,
      ]);
      if (r.orderedAt) row.getCell(4).numFmt = DATETIME_FORMAT;
      if (r.demobilizedAt) row.getCell(5).numFmt = DATETIME_FORMAT;
    }
  }

  // ══════════════════════════════════════════════════════════
  // Sheet 9: Timeline (cost by period)
  // ══════════════════════════════════════════════════════════
  const wsTimeline = wb.addWorksheet('Timeline');
  wsTimeline.columns = [
    { header: 'Op Period #', key: 'period', width: 14 },
    { header: 'Period Start', key: 'start', width: 18 },
    { header: 'Period End', key: 'end', width: 18 },
    { header: 'Labor', key: 'labor', width: 16 },
    { header: 'Equipment', key: 'equip', width: 16 },
    { header: 'Supplies', key: 'supply', width: 16 },
    { header: 'Contracts', key: 'contract', width: 16 },
    { header: 'Overhead', key: 'overhead', width: 16 },
    { header: 'Period Total', key: 'total', width: 16 },
  ];
  styleHeader(wsTimeline.getRow(1));

  for (const p of incident.operationalPeriods) {
    const pRecords = costRecords.filter((r) => r.operationalPeriodId === p.id);
    const byType = { LABOR: new Decimal(0), EQUIPMENT: new Decimal(0), SUPPLY: new Decimal(0), CONTRACT: new Decimal(0), OVERHEAD: new Decimal(0) };
    let periodTotal = new Decimal(0);
    for (const r of pRecords) {
      byType[r.costType as keyof typeof byType] = byType[r.costType as keyof typeof byType].plus(r.totalCost.toString());
      periodTotal = periodTotal.plus(r.totalCost.toString());
    }
    const row = wsTimeline.addRow({
      period:   p.periodNumber,
      start:    p.startTime,
      end:      p.endTime,
      labor:    byType.LABOR.toNumber(),
      equip:    byType.EQUIPMENT.toNumber(),
      supply:   byType.SUPPLY.toNumber(),
      contract: byType.CONTRACT.toNumber(),
      overhead: byType.OVERHEAD.toNumber(),
      total:    periodTotal.toNumber(),
    });
    row.getCell('start').numFmt = DATETIME_FORMAT;
    row.getCell('end').numFmt = DATETIME_FORMAT;
    for (const col of ['labor', 'equip', 'supply', 'contract', 'overhead', 'total']) {
      row.getCell(col).numFmt = MONEY_FORMAT;
    }
  }

  // ── Serialize to Buffer ────────────────────────────────────────────────────
  const buffer = await wb.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
