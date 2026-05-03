import { apiClient } from './client';
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

export const auditLogApi = {
  list: (params?: AuditLogFilters) =>
    apiClient.get<PaginatedResponse<AuditLog>>('/api/audit-logs', { params }),

  export: (params?: Omit<AuditLogFilters, 'page' | 'limit'>) =>
    apiClient.get('/api/audit-logs/export', {
      params,
      responseType: 'blob',
    }),
};
