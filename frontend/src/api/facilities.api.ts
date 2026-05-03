import { apiClient } from './client';
import type { Facility, Department, PaginatedResponse, User } from '../types';

export const facilitiesApi = {
  list: () =>
    apiClient.get<Facility[]>('/api/facilities'),

  get: (id: string) =>
    apiClient.get<Facility>(`/api/facilities/${id}`),

  create: (data: Partial<Facility>) =>
    apiClient.post<Facility>('/api/facilities', data),

  update: (id: string, data: Partial<Facility>) =>
    apiClient.put<Facility>(`/api/facilities/${id}`, data),

  getDepartments: (id: string) =>
    apiClient.get<Department[]>(`/api/facilities/${id}/departments`),

  createDepartment: (facilityId: string, data: Partial<Department>) =>
    apiClient.post<Department>(`/api/facilities/${facilityId}/departments`, data),

  getUsers: (id: string, params?: { page?: number; limit?: number }) =>
    apiClient.get<PaginatedResponse<{ user: User; hicsRole: string }>>(`/api/facilities/${id}/users`, { params }),

  createUser: (facilityId: string, data: object) =>
    apiClient.post(`/api/facilities/${facilityId}/users`, data),

  importUsers: (facilityId: string, file: File) => {
    const form = new FormData();
    form.append('file', file);
    return apiClient.post(`/api/facilities/${facilityId}/users/import`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },

  getPositions: (id: string) =>
    apiClient.get(`/api/facilities/${id}/positions`),

  getSettings: () =>
    apiClient.get('/api/health-system/settings'),

  updateSettings: (data: object) =>
    apiClient.put('/api/health-system/settings', data),
};
