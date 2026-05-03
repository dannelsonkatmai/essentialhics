import { AuditAction } from '@prisma/client';
import { prisma } from '../config/database';
import { logger } from '../config/logger';
import type { Request } from 'express';

export interface AuditLogEntry {
  actorUserId?: string;
  actorIpAddress?: string;
  actorUserAgent?: string;
  facilityId?: string;
  incidentId?: string;
  action: AuditAction;
  resourceType: string;
  resourceId: string;
  changes?: { before?: Record<string, unknown>; after?: Record<string, unknown> };
  metadata?: Record<string, unknown>;
}

export async function writeAuditLog(entry: AuditLogEntry): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        actorUserId: entry.actorUserId ?? null,
        actorIpAddress: entry.actorIpAddress ?? null,
        actorUserAgent: entry.actorUserAgent ?? null,
        facilityId: entry.facilityId ?? null,
        incidentId: entry.incidentId ?? null,
        action: entry.action,
        resourceType: entry.resourceType,
        resourceId: entry.resourceId,
        changes: entry.changes ?? undefined,
        metadata: entry.metadata ?? undefined,
      },
    });
  } catch (err) {
    // Audit failures must never break the main request flow — log and continue
    logger.error('Failed to write audit log', { err, entry });
  }
}

// Produce a field-level diff between two objects (top-level keys only)
export function diffObjects(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
  omitKeys: string[] = ['passwordHash', 'mfaSecret', 'mfaBackupCodes'],
): { before: Record<string, unknown>; after: Record<string, unknown> } {
  const changedBefore: Record<string, unknown> = {};
  const changedAfter: Record<string, unknown> = {};
  const allKeys = new Set([...Object.keys(before), ...Object.keys(after)]);
  for (const key of allKeys) {
    if (omitKeys.includes(key)) continue;
    if (JSON.stringify(before[key]) !== JSON.stringify(after[key])) {
      changedBefore[key] = before[key];
      changedAfter[key] = after[key];
    }
  }
  return { before: changedBefore, after: changedAfter };
}

export function extractRequestMeta(req: Request): {
  actorIpAddress: string;
  actorUserAgent: string;
} {
  return {
    actorIpAddress: (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim()
      ?? req.socket.remoteAddress
      ?? 'unknown',
    actorUserAgent: req.headers['user-agent'] ?? 'unknown',
  };
}
