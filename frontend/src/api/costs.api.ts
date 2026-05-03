import { apiClient } from './client';

const base = (facilityId: string, incidentId: string) =>
  `/api/facilities/${facilityId}/incidents/${incidentId}/costs`;

export const costsApi = {
  list: (facilityId: string, incidentId: string, params?: Record<string, string>) =>
    apiClient.get(base(facilityId, incidentId), { params }),

  get: (facilityId: string, incidentId: string, costId: string) =>
    apiClient.get(`${base(facilityId, incidentId)}/${costId}`),

  create: (facilityId: string, incidentId: string, data: Record<string, unknown>) =>
    apiClient.post(base(facilityId, incidentId), data),

  approve: (facilityId: string, incidentId: string, costId: string) =>
    apiClient.post(`${base(facilityId, incidentId)}/${costId}/approve`, {}),

  delete: (facilityId: string, incidentId: string, costId: string) =>
    apiClient.delete(`${base(facilityId, incidentId)}/${costId}`),

  getRollup: (facilityId: string, incidentId: string, operationalPeriodId?: string) =>
    apiClient.get(`${base(facilityId, incidentId)}/rollup`, {
      params: operationalPeriodId ? { operationalPeriodId } : {},
    }),

  computeRollup: (facilityId: string, incidentId: string) =>
    apiClient.post(`${base(facilityId, incidentId)}/rollup/compute`, {}),

  exportFemaPA: (
    facilityId: string,
    incidentId: string,
    opts?: { approvedOnly?: boolean; operationalPeriodId?: string },
  ) => apiClient.post(`${base(facilityId, incidentId)}/export/fema-pa`, opts ?? {}),

  exportPeriodPdf: (facilityId: string, incidentId: string, operationalPeriodId: string) =>
    apiClient.post(`${base(facilityId, incidentId)}/export/period-pdf`, { operationalPeriodId }),

  getExportJob: (facilityId: string, incidentId: string, exportJobId: string) =>
    apiClient.get(`${base(facilityId, incidentId)}/export/${exportJobId}`),
};

export const mutualAidApi = {
  list: (facilityId: string) =>
    apiClient.get(`/api/facilities/${facilityId}/mutual-aid`),

  get: (facilityId: string, agreementId: string) =>
    apiClient.get(`/api/facilities/${facilityId}/mutual-aid/${agreementId}`),

  create: (facilityId: string, data: Record<string, unknown>) =>
    apiClient.post(`/api/facilities/${facilityId}/mutual-aid`, data),

  update: (facilityId: string, agreementId: string, data: Record<string, unknown>) =>
    apiClient.patch(`/api/facilities/${facilityId}/mutual-aid/${agreementId}`, data),
};
