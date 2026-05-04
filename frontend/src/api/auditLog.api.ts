import { supabase } from '../lib/supabase';
import type { AuditLog, PaginatedResponse } from '../types';

export interface AuditLogFilters {
  page?: number;
  limit?: number;
  startDate?: string;
  endDate?: string;
  actorUserId?: string;
  facilityId?: string;
  action?: string;
  resourceType?: string;
}

function toAuditLog(row: Record<string, unknown>): AuditLog {
  const actor = row.app_users as Record<string, unknown> | null;
  const facility = row.facilities as Record<string, unknown> | null;
  return {
    id: row.id as string,
    timestamp: row.timestamp as string,
    actorUserId: row.actor_user_id as string | undefined,
    actorIpAddress: row.actor_ip_address as string | undefined,
    actorUserAgent: row.actor_user_agent as string | undefined,
    facilityId: row.facility_id as string | undefined,
    action: row.action as string,
    resourceType: row.resource_type as string,
    resourceId: row.resource_id as string,
    changes: row.changes as AuditLog['changes'],
    metadata: row.metadata as Record<string, unknown> | undefined,
    actorUser: actor
      ? { id: actor.id as string, email: actor.email as string, firstName: actor.first_name as string, lastName: actor.last_name as string }
      : undefined,
    facility: facility
      ? { id: facility.id as string, name: facility.name as string, shortName: facility.short_name as string }
      : undefined,
  };
}

export const auditLogApi = {
  list: async (params?: AuditLogFilters): Promise<{ data: PaginatedResponse<AuditLog> }> => {
    const page = params?.page ?? 1;
    const limit = params?.limit ?? 50;
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    let query = supabase
      .from('audit_logs')
      .select('*, app_users(id, email, first_name, last_name), facilities(id, name, short_name)', { count: 'exact' })
      .order('timestamp', { ascending: false })
      .range(from, to);

    if (params?.action) query = query.eq('action', params.action);
    if (params?.facilityId) query = query.eq('facility_id', params.facilityId);
    if (params?.actorUserId) query = query.eq('actor_user_id', params.actorUserId);
    if (params?.resourceType) query = query.eq('resource_type', params.resourceType);
    if (params?.startDate) query = query.gte('timestamp', params.startDate);
    if (params?.endDate) query = query.lte('timestamp', params.endDate);

    const { data, error, count } = await query;
    if (error) throw error;

    const total = count ?? 0;
    return {
      data: {
        data: (data ?? []).map(r => toAuditLog(r as Record<string, unknown>)),
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 },
      },
    };
  },

  export: async (params?: Omit<AuditLogFilters, 'page' | 'limit'>): Promise<{ data: Blob }> => {
    const { data } = await auditLogApi.list({ ...params, page: 1, limit: 10000 });
    const headers = ['Timestamp', 'Actor', 'Action', 'Resource Type', 'Resource ID', 'Facility', 'IP Address'];
    const rows = data.data.map(log => [
      log.timestamp,
      log.actorUser ? `${log.actorUser.firstName} ${log.actorUser.lastName}` : '(system)',
      log.action,
      log.resourceType,
      log.resourceId,
      log.facility?.shortName ?? '',
      log.actorIpAddress ?? '',
    ]);
    const csv = [headers, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    return { data: new Blob([csv], { type: 'text/csv' }) };
  },
};

// Helper to write audit log entries from the frontend
export async function writeAuditLog(entry: {
  action: string;
  resourceType: string;
  resourceId: string;
  facilityId?: string;
  changes?: { before?: Record<string, unknown>; after?: Record<string, unknown> };
  metadata?: Record<string, unknown>;
}): Promise<void> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    let actorUserId: string | null = null;
    if (user?.email) {
      const { data: appUser } = await supabase.from('app_users').select('id').eq('email', user.email).maybeSingle();
      actorUserId = (appUser as { id: string } | null)?.id ?? null;
    }
    await supabase.from('audit_logs').insert({
      timestamp: new Date().toISOString(),
      actor_user_id: actorUserId,
      facility_id: entry.facilityId ?? null,
      action: entry.action,
      resource_type: entry.resourceType,
      resource_id: entry.resourceId,
      changes: entry.changes ?? null,
      metadata: entry.metadata ?? null,
    });
  } catch {
    // Audit log failures must never break the user flow
  }
}
