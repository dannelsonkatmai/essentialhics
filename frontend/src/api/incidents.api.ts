import api from './client';

export interface Incident {
  id: string;
  facilityId: string;
  incidentNumber: string;
  name: string;
  incidentType: string;
  status: 'ACTIVE' | 'CONTROLLED' | 'CLOSED' | 'CANCELLED';
  severity: 'LEVEL_1' | 'LEVEL_2' | 'LEVEL_3' | 'EXERCISE';
  declarationTime: string;
  location?: string;
  description?: string;
  isExercise: boolean;
  incidentCommander?: { id: string; firstName: string; lastName: string } | null;
  _count?: { operationalPeriods: number };
}

export interface OperationalPeriod {
  id: string;
  incidentId: string;
  periodNumber: number;
  startTime: string;
  endTime: string;
  objectives?: string | null;
  status: string;
  iap?: { id: string; status: string; completenessScore: number } | null;
}

export interface CreateIncidentDto {
  name: string;
  incidentType: string;
  severity: string;
  declarationTime: string;
  location?: string;
  description?: string;
  isExercise: boolean;
  incidentCommanderId?: string;
}

export const incidentsApi = {
  list: (facilityId: string, params?: { status?: string; page?: number; limit?: number }) =>
    api.get<{ data: Incident[]; pagination: any }>(`/api/facilities/${facilityId}/incidents`, { params }),

  get: (facilityId: string, incidentId: string) =>
    api.get<Incident>(`/api/facilities/${facilityId}/incidents/${incidentId}`),

  create: (facilityId: string, dto: CreateIncidentDto) =>
    api.post<Incident>(`/api/facilities/${facilityId}/incidents`, dto),

  update: (facilityId: string, incidentId: string, dto: Partial<CreateIncidentDto>) =>
    api.patch<Incident>(`/api/facilities/${facilityId}/incidents/${incidentId}`, dto),

  close: (facilityId: string, incidentId: string) =>
    api.post(`/api/facilities/${facilityId}/incidents/${incidentId}/close`),

  listPeriods: (facilityId: string, incidentId: string) =>
    api.get<OperationalPeriod[]>(`/api/facilities/${facilityId}/incidents/${incidentId}/periods`),

  createPeriod: (facilityId: string, incidentId: string, dto: { startTime: string; endTime: string; objectives?: string }) =>
    api.post<OperationalPeriod>(`/api/facilities/${facilityId}/incidents/${incidentId}/periods`, dto),

  activatePeriod: (facilityId: string, incidentId: string, periodId: string) =>
    api.post(`/api/facilities/${facilityId}/incidents/${incidentId}/periods/${periodId}/activate`),
};
