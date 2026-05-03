import api from './client';

export interface PositionAssignment {
  id: string;
  incidentId: string;
  hicsRole: string;
  isActive: boolean;
  assignedAt: string;
  relievedAt?: string | null;
  assignedUser?: { id: string; firstName: string; lastName: string; email: string } | null;
}

export const positionsApi = {
  list: (facilityId: string, incidentId: string) =>
    api.get<PositionAssignment[]>(`/api/facilities/${facilityId}/incidents/${incidentId}/positions`),

  assign: (facilityId: string, incidentId: string, dto: { hicsRole: string; userId: string }) =>
    api.post<PositionAssignment>(`/api/facilities/${facilityId}/incidents/${incidentId}/positions`, dto),

  relieve: (facilityId: string, incidentId: string, assignmentId: string) =>
    api.delete(`/api/facilities/${facilityId}/incidents/${incidentId}/positions/${assignmentId}`),

  vacate: (facilityId: string, incidentId: string, hicsRole: string) =>
    api.delete(`/api/facilities/${facilityId}/incidents/${incidentId}/positions/roles/${hicsRole}`),

  syncTo203: (facilityId: string, incidentId: string, iapId: string) =>
    api.post(`/api/facilities/${facilityId}/incidents/${incidentId}/positions/sync-203`, { iapId }),
};
