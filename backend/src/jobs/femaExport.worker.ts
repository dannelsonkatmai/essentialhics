/**
 * FEMA PA Export Bull Worker
 *
 * Processes ExportJob records of type FEMA_PA_XLSX.
 * Flow:
 *   1. Dequeue job from femaExportQueue
 *   2. Mark ExportJob PROCESSING
 *   3. Build XLSX workbook via fema-pa-xlsx.builder.ts
 *   4. Upload buffer to MinIO
 *   5. Generate 72-hour presigned URL
 *   6. Mark ExportJob COMPLETED with fileUrl
 *   7. Notify requester in-app
 *
 * On failure: mark ExportJob FAILED, store errorMessage, retry up to 3×
 */

import Queue from 'bull';
import { prisma } from '../config/database';
import { logger } from '../config/logger';
import { config } from '../config';
import { uploadBuffer, getSignedUrl } from '../config/minio';
import { buildFemaPaXlsx } from '../reports/fema-pa-xlsx.builder';
import { createNotification } from '../modules/notifications/notification.service';
import { emitToIncident, SocketEvents } from '../socket';

const FEMA_EXPORT_CONCURRENCY = 2;

export interface FemaExportJobData {
  exportJobId: string;
  incidentId: string;
  requestedByUserId: string;
  approvedOnly?: boolean;
  operationalPeriodId?: string;
}

export const femaExportQueue = new Queue<FemaExportJobData>('fema-export', config.REDIS_URL, {
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 10_000 },
    removeOnComplete: 50,
    removeOnFail: 100,
  },
});

export function enqueueFemaExport(data: FemaExportJobData) {
  return femaExportQueue.add(data);
}

// ─── Worker process ───────────────────────────────────────────────────────────

femaExportQueue.process(FEMA_EXPORT_CONCURRENCY, async (job) => {
  const { exportJobId, incidentId, requestedByUserId, approvedOnly, operationalPeriodId } = job.data;

  logger.info(`[fema-export] Starting job ${exportJobId} for incident ${incidentId}`);

  await prisma.exportJob.update({
    where: { id: exportJobId },
    data: { status: 'PROCESSING', startedAt: new Date(), progress: 5 },
  });

  emitToIncident(incidentId, SocketEvents.EXPORT_JOB_PROGRESS, {
    exportJobId, progress: 5, status: 'PROCESSING',
  });

  try {
    // ── Build XLSX buffer ────────────────────────────────────────────────────
    await job.progress(10);
    const xlsxBuffer = await buildFemaPaXlsx({ incidentId, approvedOnly, operationalPeriodId });

    await prisma.exportJob.update({ where: { id: exportJobId }, data: { progress: 60 } });
    emitToIncident(incidentId, SocketEvents.EXPORT_JOB_PROGRESS, { exportJobId, progress: 60 });

    // ── Upload to MinIO ──────────────────────────────────────────────────────
    const incident = await prisma.incident.findUnique({
      where: { id: incidentId },
      select: { incidentNumber: true },
    });

    const timestamp = Date.now();
    const objectName = `exports/${incident!.incidentNumber}/fema-pa-${timestamp}.xlsx`;

    await uploadBuffer(
      objectName,
      xlsxBuffer,
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );

    await prisma.exportJob.update({ where: { id: exportJobId }, data: { progress: 85 } });
    emitToIncident(incidentId, SocketEvents.EXPORT_JOB_PROGRESS, { exportJobId, progress: 85 });

    // ── Generate signed URL (72 h) ───────────────────────────────────────────
    const fileUrl = await getSignedUrl(objectName);

    await prisma.exportJob.update({
      where: { id: exportJobId },
      data: {
        status: 'COMPLETED',
        progress: 100,
        fileUrl,
        completedAt: new Date(),
      },
    });

    emitToIncident(incidentId, SocketEvents.EXPORT_JOB_PROGRESS, {
      exportJobId, progress: 100, status: 'COMPLETED', fileUrl,
    });

    await createNotification({
      recipientUserId: requestedByUserId,
      incidentId,
      type: 'REPORT_READY',
      title: 'FEMA PA Report Ready',
      body: 'Your FEMA Public Assistance XLSX report is ready for download (available 72 hours).',
      actionUrl: `/incidents/${incidentId}/costs/export`,
    });

    logger.info(`[fema-export] Job ${exportJobId} completed — ${fileUrl}`);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error(`[fema-export] Job ${exportJobId} failed: ${message}`);

    await prisma.exportJob.update({
      where: { id: exportJobId },
      data: {
        status: 'FAILED',
        errorMessage: message,
        completedAt: new Date(),
      },
    }).catch(() => {});

    emitToIncident(incidentId, SocketEvents.EXPORT_JOB_PROGRESS, {
      exportJobId, progress: 0, status: 'FAILED', errorMessage: message,
    });

    throw err; // Let Bull handle retries
  }
});

femaExportQueue.on('failed', (job, err) => {
  logger.error(`[fema-export] Job permanently failed after ${job.opts.attempts} attempts:`, err.message);
});

logger.info('[fema-export] Worker ready');
