import api from './client';

export type IapStatus = 'DRAFT' | 'IN_REVIEW' | 'APPROVED' | 'PUBLISHED' | 'ARCHIVED';

export interface Iap {
  id: string;
  operationalPeriodId: string;
  status: IapStatus;
  completenessScore: number;
  formCompleteness: Record<string, number> | null;
  submittedAt?: string | null;
  submittedById?: string | null;
  reviewedAt?: string | null;
  publishedAt?: string | null;
  operationalPeriod: {
    id: string;
    periodNumber: number;
    startTime: string;
    endTime: string;
    incident: { id: string; name: string; incidentNumber: string; facilityId: string };
    iapForms201: any[];
    iapForms202: any[];
    iapForms203: any[];
    iapForms204: any[];
    iapForms207: any[];
    iapForms215: any[];
    iapForms215a: any[];
    iapFormsHics251: any[];
    iapFormsHics252: any[];
  };
  iapReviewAssignments: any[];
  comments: any[];
}

export const iapApi = {
  get: (iapId: string) =>
    api.get<Iap>(`/api/iap/${iapId}`),

  saveForm: (iapId: string, formNumber: string, formData: Record<string, unknown>) =>
    api.patch<{ form: any; completenessScore: number }>(`/api/iap/${iapId}/forms/${formNumber}`, { formData }),

  saveForm204: (iapId: string, dto: { branchName: string; divisionGroupName: string; formData: Record<string, unknown> }) =>
    api.post<{ form: any; completenessScore: number }>(`/api/iap/${iapId}/forms/204`, dto),

  updateForm204: (iapId: string, form204Id: string, dto: { branchName: string; divisionGroupName: string; formData: Record<string, unknown> }) =>
    api.patch<{ form: any; completenessScore: number }>(`/api/iap/${iapId}/forms/204/${form204Id}`, dto),

  submit: (iapId: string) =>
    api.post(`/api/iap/${iapId}/submit`),

  approve: (iapId: string) =>
    api.post(`/api/iap/${iapId}/approve`),

  returnToDraft: (iapId: string, notes: string) =>
    api.post(`/api/iap/${iapId}/return`, { notes }),

  publish: (iapId: string, signatureData: string) =>
    api.post(`/api/iap/${iapId}/publish`, { signatureData }),

  archive: (iapId: string) =>
    api.post(`/api/iap/${iapId}/archive`),

  assignReviewer: (iapId: string, reviewerUserId: string) =>
    api.post(`/api/iap/${iapId}/reviewers`, { reviewerUserId }),

  addComment: (iapId: string, dto: { body: string; formReference?: string | null; parentId?: string | null }) =>
    api.post(`/api/iap/${iapId}/comments`, dto),

  resolveComment: (iapId: string, commentId: string) =>
    api.post(`/api/iap/${iapId}/comments/${commentId}/resolve`),

  requestExport: (iapId: string, formNumbers?: string[]) =>
    api.post<{ exportJobId: string; status: string }>(`/api/iap/${iapId}/export`, { formNumbers }),

  getExportJob: (iapId: string, exportJobId: string) =>
    api.get<{ id: string; status: string; downloadUrl: string | null; fileSizeBytes: number | null }>(
      `/api/iap/${iapId}/export/${exportJobId}`,
    ),

  listMessages213: (facilityId: string, incidentId: string, params?: { page?: number; limit?: number }) =>
    api.get(`/api/facilities/${facilityId}/incidents/${incidentId}/forms/213`, { params }),

  createMessage213: (facilityId: string, incidentId: string, formData: Record<string, unknown>) =>
    api.post(`/api/facilities/${facilityId}/incidents/${incidentId}/forms/213`, { formData }),
};
