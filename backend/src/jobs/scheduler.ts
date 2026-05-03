/**
 * Phase 3 Cron Scheduler
 *
 * Schedules:
 *   - cost-rollup:       every 15 min  — recompute CostRollup for all ACTIVE incidents
 *   - eta-alert:         every 5 min   — check for overdue ETAs on ORDERED/IN_TRANSIT resources
 *   - request-escalation: every 30 min — escalate SUBMITTED requests pending > threshold
 *   - period-cost-snapshot: on period close (event-driven, not cron)
 *   - daily-cost-digest: 06:00 UTC     — send daily cost summary to Finance/Admin chief
 */

import cron from 'node-cron';
import { prisma } from '../config/database';
import { logger } from '../config/logger';
import { computeCostRollup } from '../modules/costs/cost-calculation.service';
import { createNotification } from '../modules/notifications/notification.service';

// ─── Cost Rollup (every 15 min) ───────────────────────────────────────────────

export function startCostRollupJob() {
  cron.schedule('*/15 * * * *', async () => {
    logger.info('[cron:cost-rollup] Starting cost rollup for all active incidents...');
    try {
      const activeIncidents = await prisma.incident.findMany({
        where: { status: 'ACTIVE', isDeleted: false },
        select: { id: true, incidentNumber: true },
      });

      let succeeded = 0;
      let failed = 0;
      for (const incident of activeIncidents) {
        try {
          await computeCostRollup(incident.id);
          succeeded++;
        } catch (err) {
          failed++;
          logger.error(`[cron:cost-rollup] Failed for incident ${incident.incidentNumber}: ${err}`);
        }
      }
      logger.info(`[cron:cost-rollup] Done. ${succeeded} succeeded, ${failed} failed.`);
    } catch (err) {
      logger.error('[cron:cost-rollup] Fatal error:', err);
    }
  });
  logger.info('[cron:cost-rollup] Scheduled every 15 minutes');
}

// ─── ETA Alert (every 5 min) ──────────────────────────────────────────────────

/** Alert threshold: notify if ETA is within 2 hours and resource is still ORDERED/IN_TRANSIT */
const ETA_ALERT_THRESHOLD_MS = 2 * 60 * 60 * 1000; // 2 hours

export function startEtaAlertJob() {
  cron.schedule('*/5 * * * *', async () => {
    const now = new Date();
    const alertWindow = new Date(now.getTime() + ETA_ALERT_THRESHOLD_MS);

    try {
      const overdueResources = await prisma.incidentResource.findMany({
        where: {
          status: { in: ['ORDERED', 'IN_TRANSIT'] },
          eta: { lte: alertWindow, gte: now }, // ETA within 2 hours
          isDeleted: false,
        },
        include: {
          incident: {
            select: { id: true, facilityId: true, incidentNumber: true },
          },
        },
      });

      for (const resource of overdueResources) {
        // Find LOGISTICS_SECTION_CHIEF for the incident
        const assignments = await prisma.incidentPositionAssignment.findMany({
          where: {
            incidentId: resource.incidentId,
            isActive: true,
            hicsRole: { in: ['LOGISTICS_SECTION_CHIEF', 'SUPPLY_UNIT_LEADER'] },
            assignedUserId: { not: null },
          },
          select: { assignedUserId: true },
        });

        const etaStr = resource.eta!.toLocaleString('en-US', { timeZone: 'UTC' });

        for (const a of assignments) {
          if (!a.assignedUserId) continue;
          await createNotification({
            recipientUserId: a.assignedUserId,
            incidentId: resource.incidentId,
            type: 'ETA_ALERT',
            title: 'Resource ETA Approaching',
            body: `${resource.name} (${resource.status}) is expected to arrive by ${etaStr}. Check in when received.`,
            actionUrl: `/incidents/${resource.incidentId}/resources`,
          }).catch(() => {}); // Non-fatal
        }
      }

      if (overdueResources.length > 0) {
        logger.info(`[cron:eta-alert] Sent alerts for ${overdueResources.length} resources approaching ETA`);
      }
    } catch (err) {
      logger.error('[cron:eta-alert] Error:', err);
    }
  });
  logger.info('[cron:eta-alert] Scheduled every 5 minutes');
}

// ─── Request Escalation (every 30 min) ───────────────────────────────────────

/** Escalate SUBMITTED requests pending for more than this threshold */
const ESCALATION_THRESHOLD_HOURS: Record<string, number> = {
  IMMEDIATE: 1,
  PRIORITY: 4,
  ROUTINE: 24,
};

export function startRequestEscalationJob() {
  cron.schedule('*/30 * * * *', async () => {
    const now = new Date();

    try {
      const pendingRequests = await prisma.resourceRequest.findMany({
        where: {
          status: 'SUBMITTED',
          isDeleted: false,
        },
        select: {
          id: true,
          requestNumber: true,
          priority: true,
          submittedAt: true,
          incidentId: true,
          requestedByUserId: true,
          incident: { select: { facilityId: true } },
        },
      });

      let escalated = 0;
      for (const req of pendingRequests) {
        if (!req.submittedAt) continue;
        const thresholdHours = ESCALATION_THRESHOLD_HOURS[req.priority] ?? 24;
        const ageHours = (now.getTime() - req.submittedAt.getTime()) / (1000 * 60 * 60);

        if (ageHours >= thresholdHours) {
          // Find INCIDENT_COMMANDER and LOGISTICS_SECTION_CHIEF
          const assignments = await prisma.incidentPositionAssignment.findMany({
            where: {
              incidentId: req.incidentId,
              isActive: true,
              hicsRole: { in: ['INCIDENT_COMMANDER', 'LOGISTICS_SECTION_CHIEF'] },
              assignedUserId: { not: null },
            },
            select: { assignedUserId: true },
          });

          for (const a of assignments) {
            if (!a.assignedUserId) continue;
            await createNotification({
              recipientUserId: a.assignedUserId,
              incidentId: req.incidentId,
              type: 'REQUEST_SUBMITTED',
              title: `⚠ Resource Request Needs Attention (${req.priority})`,
              body: `Request ${req.requestNumber} has been pending for ${Math.floor(ageHours)}h and requires approval.`,
              actionUrl: `/incidents/${req.incidentId}/resources/requests/${req.id}`,
            }).catch(() => {});
          }
          escalated++;
        }
      }

      if (escalated > 0) {
        logger.info(`[cron:request-escalation] Escalated ${escalated} requests`);
      }
    } catch (err) {
      logger.error('[cron:request-escalation] Error:', err);
    }
  });
  logger.info('[cron:request-escalation] Scheduled every 30 minutes');
}

// ─── Daily Cost Digest (06:00 UTC) ───────────────────────────────────────────

export function startDailyCostDigestJob() {
  cron.schedule('0 6 * * *', async () => {
    logger.info('[cron:daily-cost-digest] Generating daily cost digests...');

    try {
      const activeIncidents = await prisma.incident.findMany({
        where: { status: 'ACTIVE', isDeleted: false },
        include: {
          facility: { select: { name: true } },
          positionAssignments: {
            where: {
              isActive: true,
              hicsRole: { in: ['FINANCE_ADMIN_SECTION_CHIEF', 'COST_UNIT_LEADER'] },
              assignedUserId: { not: null },
            },
            select: { assignedUserId: true },
          },
        },
      });

      for (const incident of activeIncidents) {
        const rollup = await prisma.costRollup.findFirst({
          where: { incidentId: incident.id, operationalPeriodId: null },
          orderBy: { computedAt: 'desc' },
        });
        if (!rollup) continue;

        const totalStr = new (await import('decimal.js')).default(rollup.totalCost.toString()).toFixed(2);

        for (const a of incident.positionAssignments) {
          if (!a.assignedUserId) continue;
          await createNotification({
            recipientUserId: a.assignedUserId,
            incidentId: incident.id,
            type: 'COST_ROLLUP_READY',
            title: `Daily Cost Digest — ${incident.facility.name}`,
            body: `Incident ${incident.incidentNumber} total cost to date: $${totalStr}. ` +
              `${rollup.recordCount} records (${rollup.headcount} personnel).`,
            actionUrl: `/incidents/${incident.id}/costs`,
          }).catch(() => {});
        }
      }
      logger.info('[cron:daily-cost-digest] Done');
    } catch (err) {
      logger.error('[cron:daily-cost-digest] Error:', err);
    }
  });
  logger.info('[cron:daily-cost-digest] Scheduled at 06:00 UTC daily');
}

// ─── Scheduler entry point ────────────────────────────────────────────────────

export function startAllCronJobs() {
  startCostRollupJob();
  startEtaAlertJob();
  startRequestEscalationJob();
  startDailyCostDigestJob();
  logger.info('[scheduler] All Phase 3 cron jobs started');
}

// Allow running scheduler as standalone process
if (require.main === module) {
  startAllCronJobs();
  logger.info('[scheduler] Running standalone — keeping process alive');
}
