import Bull from 'bull';
import { redis } from '../config/redis';

const redisOpts = {
  createClient: (type: 'client' | 'subscriber' | 'bclient') => {
    // Bull needs separate connections for client, subscriber, and bclient
    if (type === 'client') return redis;
    return redis.duplicate();
  },
};

export const pdfExportQueue = new Bull<PdfExportJobData>('pdf-export', { redis: redisOpts as any });

export interface PdfExportJobData {
  exportJobId: string;
  iapId: string;
  requestedByUserId: string;
  formNumbers?: string[]; // if undefined → export all forms
}

export const PDF_EXPORT_CONCURRENCY = 2;

export async function enqueuePdfExport(data: PdfExportJobData): Promise<Bull.Job<PdfExportJobData>> {
  return pdfExportQueue.add(data, {
    attempts: 3,
    backoff: { type: 'exponential', delay: 5000 },
    removeOnComplete: 100,
    removeOnFail: 50,
  });
}
