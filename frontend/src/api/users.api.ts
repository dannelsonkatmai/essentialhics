import { apiClient } from './client';
import type { User, PaginatedResponse } from '../types';

export interface ListUsersParams {
  page?: number;
  limit?: number;
  facilityId?: string;
  role?: string;
  status?: 'active' | 'inactive' | 'locked';
  search?: string;
}

export const usersApi = {
  list: (params?: ListUsersParams) =>
    apiClient.get<PaginatedResponse<User>>('/api/users', { params }),

  get: (id: string) =>
    apiClient.get<User>(`/api/users/${id}`),

  update: (id: string, data: Partial<User>) =>
    apiClient.put<User>(`/api/users/${id}`, data),

  deactivate: (id: string) =>
    apiClient.patch(`/api/users/${id}/deactivate`),

  assignRole: (id: string, data: { facilityId: string; hicsRole: string; isPrimaryFacility?: boolean }) =>
    apiClient.post(`/api/users/${id}/roles`, data),

  removeRole: (id: string, roleId: string) =>
    apiClient.delete(`/api/users/${id}/roles/${roleId}`),

  revokeSession: (userId: string, sessionId: string) =>
    apiClient.post(`/api/users/${userId}/sessions/${sessionId}/revoke`),
};
