/**
 * Period Cost PDF Export Worker
 *
 * Generates a PDF cost summary for a single operational period.
 * Uses Puppeteer + pdf-lib (same pattern as IAP PDF export).
 * Triggered when an operational period is closed/completed.
 */

import Queue from 'bull';
import puppeteer from 'puppeteer';
import { PDFDocument } from 'pdf-lib';
import { prisma } from '../config/database';
import { logger } from '../config/logger';
import { config } from '../config';
import { uploadBuffer, getSignedUrl } from '../config/minio';
import { createNotification } from '../modules/notifications/notification.service';
import { emitToIncident, SocketEvents } from '../socket';
import Decimal from 'decimal.js';

const PERIOD_COST_PDF_CONCURRENCY = 1;

export interface PeriodCostPdfJobData {
  exportJobId: string;
  incidentId: string;
  operationalPeriodId: string;
  requestedByUserId: string;
}

export const periodCostPdfQueue = new Queue<PeriodCostPdfJobData>('period-cost-pdf', config.REDIS_URL, {
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 15_000 },
    removeOnComplete: 30,
    removeOnFail: 50,
  },
});

export function enqueuePeriodCostPdf(data: PeriodCostPdfJobData) {
  return periodCostPdfQueue.add(data);
}

periodCostPdfQueue.process(PERIOD_COST_PDF_CONCURRENCY, async (job) => {
  const { exportJobId, incidentId, operationalPeriodId, requestedByUserId } = job.data;

  logger.info(`[period-cost-pdf] Starting job ${exportJobId}`);

  await prisma.exportJob.update({
    where: { id: exportJobId },
    data: { status: 'PROCESSING', startedAt: new Date(), progress: 5 },
  });

  emitToIncident(incidentId, SocketEvents.EXPORT_JOB_PROGRESS, { exportJobId, progress: 5 });

  try {
    // ── Load data ────────────────────────────────────────────────────────────
    const [incident, period, records, rollup] = await Promise.all([
      prisma.incident.findUnique({
        where: { id: incidentId },
        select: { incidentNumber: true, name: true, facility: { select: { name: true } } },
      }),
      prisma.operationalPeriod.findUnique({
        where: { id: operationalPeriodId },
        select: { periodNumber: true, startTime: true, endTime: true },
      }),
      prisma.costRecord.findMany({
        where: { incidentId, operationalPeriodId, isDeleted: false },
        include: { laborCostRecord: true, equipmentCostRecord: true },
        orderBy: { costType: 'asc' },
      }),
      prisma.costRollup.findFirst({
        where: { incidentId, operationalPeriodId },
        orderBy: { computedAt: 'desc' },
      }),
    ]);

    if (!incident || !period) throw new Error('Incident or period not found');

    await prisma.exportJob.update({ where: { id: exportJobId }, data: { progress: 20 } });

    // ── Render HTML ──────────────────────────────────────────────────────────
    const totalCost = rollup
      ? new Decimal(rollup.totalCost.toString()).toFixed(2)
      : records.reduce((s, r) => s.plus(r.totalCost.toString()), new Decimal(0)).toFixed(2);

    const html = buildPeriodCostHtml({
      incidentName: incident.name,
      incidentNumber: incident.incidentNumber,
      facilityName: incident.facility.name,
      periodNumber: period.periodNumber,
      periodStart: period.startTime,
      periodEnd: period.endTime,
      totalCost,
      rollup,
      records,
    });

    await prisma.exportJob.update({ where: { id: exportJobId }, data: { progress: 40 } });

    // ── Render PDF via Puppeteer ─────────────────────────────────────────────
    const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
    let pdfBuffer: Buffer;
    try {
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'networkidle0' });
      pdfBuffer = Buffer.from(await page.pdf({ format: 'Letter', printBackground: true, margin: { top: '0.5in', bottom: '0.5in', left: '0.75in', right: '0.75in' } }));
    } finally {
      await browser.close();
    }

    await prisma.exportJob.update({ where: { id: exportJobId }, data: { progress: 75 } });

    // ── Upload + sign ─────────────────────────────────────────────────────────
    const timestamp = Date.now();
    const objectName = `exports/${incident.incidentNumber}/period-${period.periodNumber}-costs-${timestamp}.pdf`;
    await uploadBuffer(objectName, pdfBuffer, 'application/pdf');
    const fileUrl = await getSignedUrl(objectName);

    await prisma.exportJob.update({
      where: { id: exportJobId },
      data: { status: 'COMPLETED', progress: 100, fileUrl, completedAt: new Date() },
    });

    emitToIncident(incidentId, SocketEvents.EXPORT_JOB_PROGRESS, {
      exportJobId, progress: 100, status: 'COMPLETED', fileUrl,
    });

    await createNotification({
      recipientUserId: requestedByUserId,
      incidentId,
      type: 'REPORT_READY',
      title: `Period ${period.periodNumber} Cost Summary Ready`,
      body: `Cost summary PDF for Operational Period ${period.periodNumber} is ready for download.`,
      actionUrl: `/incidents/${incidentId}/costs`,
    });

    logger.info(`[period-cost-pdf] Job ${exportJobId} completed`);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error(`[period-cost-pdf] Job ${exportJobId} failed: ${message}`);
    await prisma.exportJob.update({
      where: { id: exportJobId },
      data: { status: 'FAILED', errorMessage: message, completedAt: new Date() },
    }).catch(() => {});
    throw err;
  }
});

// ─── HTML template for period cost PDF ───────────────────────────────────────

function buildPeriodCostHtml(data: {
  incidentName: string;
  incidentNumber: string;
  facilityName: string;
  periodNumber: number;
  periodStart: Date;
  periodEnd: Date;
  totalCost: string;
  rollup: Record<string, unknown> | null;
  records: Array<{ costType: string; description: string; totalCost: { toString(): string }; isApproved: boolean }>;
}) {
  const fmt = (d: Date) => d.toLocaleString('en-US', { timeZone: 'UTC' });
  const money = (v: string) => `$${parseFloat(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const rows = data.records.map((r) => `
    <tr>
      <td>${r.costType}</td>
      <td>${r.description}</td>
      <td style="text-align:right">${money(r.totalCost.toString())}</td>
      <td style="text-align:center">${r.isApproved ? '✓' : ''}</td>
    </tr>
  `).join('');

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"/>
<style>
  body { font-family: Arial, sans-serif; font-size: 11px; color: #222; }
  h1 { color: #1B3A6B; font-size: 16px; margin-bottom: 4px; }
  h2 { color: #1B3A6B; font-size: 13px; border-bottom: 2px solid #1B3A6B; padding-bottom: 4px; }
  .meta { display: grid; grid-template-columns: 1fr 1fr; gap: 4px 24px; margin-bottom: 20px; }
  .meta span { color: #555; }
  table { width: 100%; border-collapse: collapse; margin-top: 12px; }
  th { background: #1B3A6B; color: #fff; padding: 6px 8px; text-align: left; font-size: 10px; }
  td { padding: 5px 8px; border-bottom: 1px solid #e2e8f0; }
  tr:nth-child(even) td { background: #f8fafc; }
  .total { font-weight: bold; font-size: 13px; margin-top: 8px; text-align: right; }
</style></head>
<body>
<h1>Incident Cost Summary — Operational Period ${data.periodNumber}</h1>
<div class="meta">
  <div><strong>Incident:</strong> ${data.incidentName} (${data.incidentNumber})</div>
  <div><strong>Facility:</strong> ${data.facilityName}</div>
  <div><strong>Period Start:</strong> ${fmt(data.periodStart)}</div>
  <div><strong>Period End:</strong> ${fmt(data.periodEnd)}</div>
  <div><strong>Generated:</strong> ${fmt(new Date())}</div>
</div>
<h2>Cost Records</h2>
<table>
  <thead><tr><th>Type</th><th>Description</th><th>Amount</th><th>Approved</th></tr></thead>
  <tbody>${rows}</tbody>
</table>
<div class="total">Period Total: ${money(data.totalCost)}</div>
</body></html>`;
}

logger.info('[period-cost-pdf] Worker ready');
