import { apiClient } from './client';

const base = (facilityId: string, incidentId: string) =>
  `/api/facilities/${facilityId}/incidents/${incidentId}/resources`;

const catalogBase = (facilityId: string) =>
  `/api/facilities/${facilityId}/resource-catalog`;

export const resourcesApi = {
  // Incident resources
  list: (facilityId: string, incidentId: string, params?: Record<string, string>) =>
    apiClient.get(base(facilityId, incidentId), { params }),

  summary: (facilityId: string, incidentId: string) =>
    apiClient.get(`${base(facilityId, incidentId)}/summary`),

  get: (facilityId: string, incidentId: string, resourceId: string) =>
    apiClient.get(`${base(facilityId, incidentId)}/${resourceId}`),

  create: (facilityId: string, incidentId: string, data: Record<string, unknown>) =>
    apiClient.post(base(facilityId, incidentId), data),

  update: (facilityId: string, incidentId: string, resourceId: string, data: Record<string, unknown>) =>
    apiClient.patch(`${base(facilityId, incidentId)}/${resourceId}`, data),

  delete: (facilityId: string, incidentId: string, resourceId: string) =>
    apiClient.delete(`${base(facilityId, incidentId)}/${resourceId}`),

  transition: (
    facilityId: string,
    incidentId: string,
    resourceId: string,
    data: { toStatus: string; location?: string; notes?: string; assignedToRole?: string; assignedToLocation?: string },
  ) => apiClient.post(`${base(facilityId, incidentId)}/${resourceId}/transition`, data),

  demobilize: (facilityId: string, incidentId: string, resourceId: string, notes?: string) =>
    apiClient.post(`${base(facilityId, incidentId)}/${resourceId}/demobilize`, { notes }),

  bulkCheckIn: (facilityId: string, incidentId: string, resourceIds: string[], location?: string) =>
    apiClient.post(`${base(facilityId, incidentId)}/bulk-checkin`, { resourceIds, location }),

  history: (facilityId: string, incidentId: string, resourceId: string) =>
    apiClient.get(`${base(facilityId, incidentId)}/${resourceId}/history`),

  // Resource catalog
  listTypes: (facilityId: string, params?: Record<string, string>) =>
    apiClient.get(catalogBase(facilityId), { params }),

  getType: (facilityId: string, typeId: string) =>
    apiClient.get(`${catalogBase(facilityId)}/${typeId}`),

  createType: (facilityId: string, data: Record<string, unknown>) =>
    apiClient.post(catalogBase(facilityId), data),

  updateType: (facilityId: string, typeId: string, data: Record<string, unknown>) =>
    apiClient.patch(`${catalogBase(facilityId)}/${typeId}`, data),

  deleteType: (facilityId: string, typeId: string) =>
    apiClient.delete(`${catalogBase(facilityId)}/${typeId}`),

  getInventory: (facilityId: string) =>
    apiClient.get(`${catalogBase(facilityId)}/inventory`),

  upsertInventory: (facilityId: string, resourceTypeId: string, data: Record<string, unknown>) =>
    apiClient.put(`${catalogBase(facilityId)}/inventory/${resourceTypeId}`, data),
};
