import puppeteer from 'puppeteer';
import path from 'path';
import { pdfExportQueue, PDF_EXPORT_CONCURRENCY, PdfExportJobData } from './queue';
import { prisma } from '../config/database';
import { uploadBuffer, getSignedUrl, ensureBucket } from '../config/minio';
import { logger } from '../config/logger';
import {
  renderForm201, renderForm202, renderForm203, renderForm204, renderForm207,
  renderForm213, renderForm215, renderForm215a, renderFormHics251, renderFormHics252,
} from '../pdf/templates';

async function renderHtmlToPdf(html: string): Promise<Buffer> {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu'],
  });
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    const pdf = await page.pdf({
      format: 'Letter',
      margin: { top: '0.5in', right: '0.5in', bottom: '0.5in', left: '0.5in' },
      printBackground: true,
    });
    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}

pdfExportQueue.process(PDF_EXPORT_CONCURRENCY, async (job) => {
  const { exportJobId, iapId, formNumbers } = job.data as PdfExportJobData;

  logger.info(`[pdf-worker] Starting export job ${exportJobId} for IAP ${iapId}`);

  await prisma.exportJob.update({
    where: { id: exportJobId },
    data: { status: 'PROCESSING', startedAt: new Date() },
  });

  try {
    await ensureBucket();

    // Load IAP with all form data
    const iap = await prisma.iap.findUniqueOrThrow({
      where: { id: iapId },
      include: {
        operationalPeriod: {
          include: {
            incident: { select: { name: true, incidentNumber: true } },
            iapForms201: { orderBy: { createdAt: 'desc' }, take: 1 },
            iapForms202: { orderBy: { createdAt: 'desc' }, take: 1 },
            iapForms203: { orderBy: { createdAt: 'desc' }, take: 1 },
            iapForms204: true,
            iapForms207: { orderBy: { createdAt: 'desc' }, take: 1 },
            iapForms215: { orderBy: { createdAt: 'desc' }, take: 1 },
            iapForms215a: { orderBy: { createdAt: 'desc' }, take: 1 },
            iapFormsHics251: { orderBy: { createdAt: 'desc' }, take: 1 },
            iapFormsHics252: {
              orderBy: { createdAt: 'desc' },
              take: 1,
              // include signatureData for PDF rendering
            },
          },
        },
      },
    });

    const period = iap.operationalPeriod;
    const incidentName = period.incident.name;
    const incidentNumber = period.incident.incidentNumber;

    // Build form data maps
    const f = {
      '201': period.iapForms201[0]?.formData as Record<string, unknown> ?? {},
      '202': period.iapForms202[0]?.formData as Record<string, unknown> ?? {},
      '203': period.iapForms203[0]?.formData as Record<string, unknown> ?? {},
      '204': period.iapForms204.map(r => ({ ...r, formData: r.formData as Record<string, unknown> })),
      '207': period.iapForms207[0]?.formData as Record<string, unknown> ?? {},
      '215': period.iapForms215[0]?.formData as Record<string, unknown> ?? {},
      '215a': period.iapForms215a[0]?.formData as Record<string, unknown> ?? {},
      'hics251': period.iapFormsHics251[0]?.formData as Record<string, unknown> ?? {},
      'hics252': period.iapFormsHics252[0],
    };

    // ICS-213 is incident-scoped — fetch separately
    const msgs213 = await prisma.iapForm213.findMany({
      where: { incidentId: period.incidentId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    const target = formNumbers ?? ['201', '202', '203', '204', '207', '213', '215', '215a', 'hics251', 'hics252'];

    const pdfParts: Buffer[] = [];

    for (const fn of target) {
      let html = '';
      switch (fn) {
        case '201': html = renderForm201(f['201'], incidentName); break;
        case '202': html = renderForm202(f['202'], incidentName); break;
        case '203': html = renderForm203(f['203'], incidentName); break;
        case '204': html = renderForm204(f['204'], incidentName); break;
        case '207': html = renderForm207(f['207'], incidentName); break;
        case '213':
          for (const msg of msgs213) {
            html = renderForm213(msg.formData as Record<string, unknown>);
            pdfParts.push(await renderHtmlToPdf(html));
          }
          continue;
        case '215': html = renderForm215(f['215'], incidentName); break;
        case '215a': html = renderForm215a(f['215a'], incidentName); break;
        case 'hics251': html = renderFormHics251(f['hics251'], incidentName); break;
        case 'hics252': {
          const h252 = f['hics252'];
          const sigData = h252?.iapSignatureData ?? undefined;
          html = renderFormHics252(
            (h252?.formData as Record<string, unknown>) ?? {},
            incidentName,
            sigData ?? undefined,
          );
          break;
        }
        default:
          logger.warn(`[pdf-worker] Unknown form number: ${fn}, skipping`);
          continue;
      }
      pdfParts.push(await renderHtmlToPdf(html));
    }

    if (pdfParts.length === 0) {
      throw new Error('No PDF pages generated');
    }

    // Merge all parts (simple concatenation — for proper merge use pdf-lib)
    const { PDFDocument } = await import('pdf-lib');
    const mergedPdf = await PDFDocument.create();
    for (const part of pdfParts) {
      const partDoc = await PDFDocument.load(part);
      const pages = await mergedPdf.copyPages(partDoc, partDoc.getPageIndices());
      pages.forEach((p) => mergedPdf.addPage(p));
    }
    const mergedBytes = await mergedPdf.save();
    const mergedBuffer = Buffer.from(mergedBytes);

    // Upload to MinIO
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const objectName = `exports/${incidentNumber}/iap-${iapId}-${timestamp}.pdf`;
    await uploadBuffer(objectName, mergedBuffer, 'application/pdf');

    const signedUrl = await getSignedUrl(objectName);

    await prisma.exportJob.update({
      where: { id: exportJobId },
      data: {
        status: 'COMPLETE',
        completedAt: new Date(),
        objectKey: objectName,
        downloadUrl: signedUrl,
        fileSizeBytes: mergedBuffer.length,
      },
    });

    logger.info(`[pdf-worker] Export job ${exportJobId} complete — ${mergedBuffer.length} bytes`);
    return { signedUrl, objectName };

  } catch (err: any) {
    logger.error(`[pdf-worker] Export job ${exportJobId} failed:`, err);

    await prisma.exportJob.update({
      where: { id: exportJobId },
      data: { status: 'FAILED', failedAt: new Date(), errorMessage: err?.message ?? 'Unknown error' },
    });

    throw err;
  }
});

pdfExportQueue.on('completed', (job, result) => {
  logger.info(`[pdf-worker] Job ${job.id} completed`);
});

pdfExportQueue.on('failed', (job, err) => {
  logger.error(`[pdf-worker] Job ${job.id} failed: ${err.message}`);
});

logger.info('[pdf-worker] PDF export worker started');
