import { apiClient } from './client';

const base = (facilityId: string, incidentId: string) =>
  `/api/facilities/${facilityId}/incidents/${incidentId}/requests`;

export const requestsApi = {
  list: (facilityId: string, incidentId: string, params?: Record<string, string>) =>
    apiClient.get(base(facilityId, incidentId), { params }),

  get: (facilityId: string, incidentId: string, requestId: string) =>
    apiClient.get(`${base(facilityId, incidentId)}/${requestId}`),

  create: (facilityId: string, incidentId: string, data: Record<string, unknown>) =>
    apiClient.post(base(facilityId, incidentId), data),

  submit: (facilityId: string, incidentId: string, requestId: string) =>
    apiClient.post(`${base(facilityId, incidentId)}/${requestId}/submit`, {}),

  approve: (facilityId: string, incidentId: string, requestId: string, approvalNotes?: string) =>
    apiClient.post(`${base(facilityId, incidentId)}/${requestId}/approve`, { approvalNotes }),

  deny: (facilityId: string, incidentId: string, requestId: string, denialReason?: string) =>
    apiClient.post(`${base(facilityId, incidentId)}/${requestId}/deny`, { denialReason }),

  cancel: (facilityId: string, incidentId: string, requestId: string) =>
    apiClient.post(`${base(facilityId, incidentId)}/${requestId}/cancel`, {}),

  fulfillLineItem: (
    facilityId: string,
    incidentId: string,
    requestId: string,
    lineItemId: string,
    data: { quantityFulfilled: number; notes?: string; incidentResourceId?: string },
  ) => apiClient.post(`${base(facilityId, incidentId)}/${requestId}/line-items/${lineItemId}/fulfill`, data),
};
