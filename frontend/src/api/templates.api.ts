import api from './client';

export interface IapTemplate {
  id: string;
  name: string;
  description?: string | null;
  facilityId?: string | null;
  parentTemplateId?: string | null;
  parentTemplate?: { id: string; name: string } | null;
  formDefaults?: Array<{ formNumber: string; defaults: Record<string, unknown> }>;
  _count?: { formDefaults: number };
}

export const templatesApi = {
  list: (facilityId?: string) =>
    api.get<IapTemplate[]>('/api/templates', { params: facilityId ? { facilityId } : undefined }),

  get: (id: string) =>
    api.get<IapTemplate>(`/api/templates/${id}`),

  resolve: (id: string) =>
    api.get<Record<string, Record<string, unknown>>>(`/api/templates/${id}/resolve`),

  create: (dto: Partial<IapTemplate>) =>
    api.post<IapTemplate>('/api/templates', dto),

  update: (id: string, dto: Partial<IapTemplate>) =>
    api.put<IapTemplate>(`/api/templates/${id}`, dto),

  delete: (id: string) =>
    api.delete(`/api/templates/${id}`),

  duplicate: (id: string, name: string) =>
    api.post<IapTemplate>(`/api/templates/${id}/duplicate`, { name }),

  listObjectives: (facilityId?: string) =>
    api.get('/api/templates/objectives', { params: facilityId ? { facilityId } : undefined }),

  createObjective: (dto: { objectiveText: string; priority: string; tags?: string[]; facilityId?: string }) =>
    api.post('/api/templates/objectives', dto),

  useObjective: (id: string) =>
    api.post(`/api/templates/objectives/${id}/use`),

  listTactics: (facilityId?: string) =>
    api.get('/api/templates/tactics', { params: facilityId ? { facilityId } : undefined }),

  createTactic: (dto: { tacticText: string; tags?: string[]; facilityId?: string }) =>
    api.post('/api/templates/tactics', dto),

  useTactic: (id: string) =>
    api.post(`/api/templates/tactics/${id}/use`),
};
