import { supabase } from '../lib/supabase';

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

async function getCurrentUserId(): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) return null;
  const { data } = await supabase.from('app_users').select('id').eq('email', user.email).maybeSingle();
  return (data as { id: string } | null)?.id ?? null;
}

function mapForm201(row: Record<string, unknown>): Record<string, unknown> {
  return {
    incidentName: row.incident_name ?? '',
    dateTimePrepared: row.date_time_initiated ?? '',
    currentSituation: row.current_situation ?? '',
    initialObjectives: row.initial_response_objectives ?? '',
    currentOrganization: row.current_organization ?? '',
    resourcesSummary: row.resources_summary ?? '',
    actionsTaken: row.actions_taken ?? '',
  };
}

function mapForm202(row: Record<string, unknown>): Record<string, unknown> {
  return {
    opPeriodStart: row.period_start ?? '',
    opPeriodEnd: row.period_end ?? '',
    incidentObjectives: row.operational_period_objectives ?? '',
    weatherForecast: row.weather_forecast ?? '',
    generalSafety: row.general_safety_message ?? '',
    attachments: row.attachment_list ?? '',
    siteAccessEgress: row.site_safety_plan_required ? 'YES' : 'NO',
  };
}

function mapForm203(row: Record<string, unknown>): Record<string, unknown> {
  const a = row.position_assignments;
  if (a && typeof a === 'object' && !Array.isArray(a)) return a as Record<string, unknown>;
  return {};
}

function mapForm204(row: Record<string, unknown>): { id: string; branchName: string; divisionGroupName: string; formData: Record<string, unknown> } {
  return {
    id: row.id as string,
    branchName: (row.branch as string) ?? '',
    divisionGroupName: (row.division_group as string) ?? '',
    formData: {
      supervisorName: row.operations_chief_name ?? '',
      supervisorContact: row.branch_director_name ?? '',
      resources: row.resources_assigned ?? '',
      workAssignments: row.work_assignments ?? '',
      specialInstructions: row.special_instructions ?? '',
      communications: row.communications_name ?? '',
    },
  };
}

function mapForm207(row: Record<string, unknown>): Record<string, unknown> {
  return { orgChartSnapshot: row.org_chart_snapshot ?? '', generatedAt: row.generated_at ?? '' };
}

function mapForm215(row: Record<string, unknown>): Record<string, unknown> {
  const wa = row.work_assignments;
  if (wa && typeof wa === 'object' && !Array.isArray(wa)) return wa as Record<string, unknown>;
  return { workAssignments: wa ?? '' };
}

function mapForm215a(row: Record<string, unknown>): Record<string, unknown> {
  const hr = row.hazard_risk_analysis;
  if (hr && typeof hr === 'object' && !Array.isArray(hr)) return hr as Record<string, unknown>;
  return { hazardousConditions: hr ?? '' };
}

function mapFormHics251(row: Record<string, unknown>): Record<string, unknown> {
  return {
    systems: Array.isArray(row.facility_systems_status) ? row.facility_systems_status : [],
    overallFacilityStatus: row.overall_facility_status ?? 'NORMAL',
    reportedAt: row.report_time ?? '',
  };
}

function mapFormHics252(row: Record<string, unknown>): Record<string, unknown> {
  return {
    iapSignatureCaptured: row.iap_signature_captured ?? false,
    iapSignedAt: row.approved_at ?? null,
    formData: {
      incidentName: row.incident_name ?? '',
      opPeriodStart: row.operational_period_start ?? '',
      opPeriodEnd: row.operational_period_end ?? '',
    },
  };
}

function computeCompleteness(period: {
  iapForms201: any[]; iapForms202: any[]; iapForms203: any[];
  iapForms204: any[]; iapForms207: any[]; iapForms215: any[];
  iapForms215a: any[]; iapFormsHics251: any[]; iapFormsHics252: any[];
}): { score: number; formCompleteness: Record<string, number> } {
  const WEIGHTS: Record<string, number> = { '201': 5, '202': 30, '203': 20, '204': 15, '207': 10, '215': 8, '215a': 7, 'hics251': 3, 'hics252': 2 };
  const has: Record<string, number> = {
    '201': period.iapForms201.length > 0 ? 100 : 0,
    '202': period.iapForms202.length > 0 ? 100 : 0,
    '203': period.iapForms203.length > 0 ? 100 : 0,
    '204': period.iapForms204.length > 0 ? 100 : 0,
    '207': period.iapForms207.length > 0 ? 100 : 0,
    '215': period.iapForms215.length > 0 ? 100 : 0,
    '215a': period.iapForms215a.length > 0 ? 100 : 0,
    'hics251': period.iapFormsHics251.length > 0 ? 100 : 0,
    'hics252': period.iapFormsHics252.length > 0 ? 100 : 0,
  };
  const totalWeight = Object.values(WEIGHTS).reduce((a, b) => a + b, 0);
  const score = Math.round(
    Object.entries(WEIGHTS).reduce((acc, [key, w]) => acc + (has[key] / 100) * w, 0) / totalWeight * 100,
  );
  return { score, formCompleteness: has };
}

export const iapApi = {
  get: async (iapId: string): Promise<{ data: Iap }> => {
    const { data: iapRow, error: iapErr } = await supabase
      .from('iaps')
      .select('*, operational_periods(*, incidents(id, name, incident_number, facility_id))')
      .eq('id', iapId)
      .maybeSingle();
    if (iapErr) throw iapErr;
    if (!iapRow) throw new Error('IAP not found');

    const periodId = iapRow.operational_period_id as string;
    const periodRow = (iapRow as any).operational_periods as Record<string, unknown>;
    const incidentRow = (periodRow as any).incidents as Record<string, unknown>;

    const [f201, f202, f203, f204, f207, f215, f215a, fh251, fh252, reviewers, comments] = await Promise.all([
      supabase.from('iap_forms_201').select('*').eq('operational_period_id', periodId),
      supabase.from('iap_forms_202').select('*').eq('operational_period_id', periodId),
      supabase.from('iap_forms_203').select('*').eq('operational_period_id', periodId),
      supabase.from('iap_forms_204').select('*').eq('operational_period_id', periodId),
      supabase.from('iap_forms_207').select('*').eq('operational_period_id', periodId),
      supabase.from('iap_forms_215').select('*').eq('operational_period_id', periodId),
      supabase.from('iap_forms_215a').select('*').eq('operational_period_id', periodId),
      supabase.from('iap_forms_hics251').select('*').eq('operational_period_id', periodId),
      supabase.from('iap_forms_hics252').select('*').eq('operational_period_id', periodId),
      supabase.from('iap_review_assignments').select('*').eq('iap_id', iapId),
      supabase.from('iap_comments').select('*').eq('iap_id', iapId).order('created_at'),
    ]);

    const forms201 = (f201.data ?? []).map(r => ({ id: r.id, formData: mapForm201(r as any) }));
    const forms202 = (f202.data ?? []).map(r => ({ id: r.id, formData: mapForm202(r as any) }));
    const forms203 = (f203.data ?? []).map(r => ({ id: r.id, formData: mapForm203(r as any) }));
    const forms204 = (f204.data ?? []).map(r => mapForm204(r as any));
    const forms207 = (f207.data ?? []).map(r => ({ id: r.id, formData: mapForm207(r as any) }));
    const forms215 = (f215.data ?? []).map(r => ({ id: r.id, formData: mapForm215(r as any) }));
    const forms215a = (f215a.data ?? []).map(r => ({ id: r.id, formData: mapForm215a(r as any) }));
    const formsHics251 = (fh251.data ?? []).map(r => ({ id: r.id, formData: mapFormHics251(r as any) }));
    const formsHics252 = (fh252.data ?? []).map(r => mapFormHics252(r as any));

    const period = {
      id: periodId,
      periodNumber: periodRow.period_number as number,
      startTime: periodRow.start_time as string,
      endTime: periodRow.end_time as string,
      incident: {
        id: incidentRow.id as string,
        name: incidentRow.name as string,
        incidentNumber: incidentRow.incident_number as string,
        facilityId: incidentRow.facility_id as string,
      },
      iapForms201: forms201,
      iapForms202: forms202,
      iapForms203: forms203,
      iapForms204: forms204,
      iapForms207: forms207,
      iapForms215: forms215,
      iapForms215a: forms215a,
      iapFormsHics251: formsHics251,
      iapFormsHics252: formsHics252,
    };

    const { score, formCompleteness } = computeCompleteness(period);

    return {
      data: {
        id: iapRow.id as string,
        operationalPeriodId: periodId,
        status: iapRow.status as IapStatus,
        completenessScore: score,
        formCompleteness,
        submittedAt: iapRow.submitted_for_review_at as string | null,
        submittedById: iapRow.submitted_by_user_id as string | null,
        reviewedAt: iapRow.reviewed_at as string | null,
        publishedAt: iapRow.published_at as string | null,
        operationalPeriod: period,
        iapReviewAssignments: reviewers.data ?? [],
        comments: comments.data ?? [],
      },
    };
  },

  saveForm: async (iapId: string, formNumber: string, formData: Record<string, unknown>): Promise<{ data: { form: any; completenessScore: number } }> => {
    const userId = await getCurrentUserId();
    const { data: iapRow } = await supabase.from('iaps').select('operational_period_id').eq('id', iapId).maybeSingle();
    if (!iapRow) throw new Error('IAP not found');
    const periodId = (iapRow as any).operational_period_id as string;

    let upsertData: Record<string, unknown> = { operational_period_id: periodId };
    switch (formNumber) {
      case '201':
        upsertData = { ...upsertData, incident_name: formData.incidentName, date_time_initiated: formData.dateTimePrepared, current_situation: formData.currentSituation, initial_response_objectives: formData.initialObjectives, current_organization: formData.currentOrganization, resources_summary: formData.resourcesSummary, actions_taken: formData.actionsTaken, prepared_by_user_id: userId };
        break;
      case '202':
        upsertData = { ...upsertData, period_start: formData.opPeriodStart, period_end: formData.opPeriodEnd, operational_period_objectives: formData.incidentObjectives, weather_forecast: formData.weatherForecast, general_safety_message: formData.generalSafety, attachment_list: formData.attachments, prepared_by_user_id: userId };
        break;
      case '203':
        upsertData = { ...upsertData, position_assignments: formData, prepared_by_user_id: userId };
        break;
      case '207':
        upsertData = { ...upsertData, org_chart_snapshot: formData.orgChartSnapshot, generated_at: new Date().toISOString(), generated_by_user_id: userId };
        break;
      case '215':
        upsertData = { ...upsertData, work_assignments: formData, prepared_by_user_id: userId };
        break;
      case '215a':
        upsertData = { ...upsertData, hazard_risk_analysis: formData, prepared_by_safety_officer_user_id: userId };
        break;
      case 'hics251':
        upsertData = { ...upsertData, facility_systems_status: formData.systems, overall_facility_status: formData.overallFacilityStatus, report_time: formData.reportedAt, prepared_by_user_id: userId };
        break;
      default:
        break;
    }

    const table = `iap_forms_${formNumber}` as any;
    const { data: existing } = await supabase.from(table).select('id').eq('operational_period_id', periodId).maybeSingle();
    let savedRow: any;
    if (existing) {
      const { data } = await supabase.from(table).update(upsertData).eq('id', (existing as any).id).select().maybeSingle();
      savedRow = data;
    } else {
      const { data } = await supabase.from(table).insert(upsertData).select().maybeSingle();
      savedRow = data;
    }

    return { data: { form: savedRow, completenessScore: 0 } };
  },

  saveForm204: async (iapId: string, dto: { branchName: string; divisionGroupName: string; formData: Record<string, unknown> }): Promise<{ data: { form: any; completenessScore: number } }> => {
    const userId = await getCurrentUserId();
    const { data: iapRow } = await supabase.from('iaps').select('operational_period_id').eq('id', iapId).maybeSingle();
    if (!iapRow) throw new Error('IAP not found');
    const periodId = (iapRow as any).operational_period_id as string;
    const { data } = await supabase.from('iap_forms_204').insert({
      operational_period_id: periodId, branch: dto.branchName, division_group: dto.divisionGroupName,
      operations_chief_name: dto.formData.supervisorName ?? '', branch_director_name: dto.formData.supervisorContact ?? '',
      resources_assigned: dto.formData.resources ?? '', work_assignments: dto.formData.workAssignments ?? '',
      special_instructions: dto.formData.specialInstructions ?? '', communications_name: dto.formData.communications ?? '',
      prepared_by_user_id: userId,
    }).select().maybeSingle();
    return { data: { form: data, completenessScore: 0 } };
  },

  updateForm204: async (iapId: string, form204Id: string, dto: { branchName: string; divisionGroupName: string; formData: Record<string, unknown> }): Promise<{ data: { form: any; completenessScore: number } }> => {
    const { data } = await supabase.from('iap_forms_204').update({
      branch: dto.branchName, division_group: dto.divisionGroupName,
      operations_chief_name: dto.formData.supervisorName ?? '', branch_director_name: dto.formData.supervisorContact ?? '',
      resources_assigned: dto.formData.resources ?? '', work_assignments: dto.formData.workAssignments ?? '',
      special_instructions: dto.formData.specialInstructions ?? '', communications_name: dto.formData.communications ?? '',
    }).eq('id', form204Id).select().maybeSingle();
    return { data: { form: data, completenessScore: 0 } };
  },

  submit: async (iapId: string) => {
    const userId = await getCurrentUserId();
    await supabase.from('iaps').update({ status: 'IN_REVIEW', submitted_for_review_at: new Date().toISOString(), submitted_by_user_id: userId }).eq('id', iapId);
    return { data: null };
  },

  approve: async (iapId: string) => {
    const userId = await getCurrentUserId();
    await supabase.from('iaps').update({ status: 'APPROVED', reviewed_at: new Date().toISOString(), reviewed_by_user_id: userId }).eq('id', iapId);
    return { data: null };
  },

  returnToDraft: async (iapId: string, notes: string) => {
    await supabase.from('iaps').update({ status: 'DRAFT', approval_notes: notes }).eq('id', iapId);
    return { data: null };
  },

  publish: async (iapId: string, signatureData: string) => {
    const userId = await getCurrentUserId();
    const { data: iapRow } = await supabase.from('iaps').select('operational_period_id').eq('id', iapId).maybeSingle();
    await supabase.from('iaps').update({ status: 'PUBLISHED', published_at: new Date().toISOString(), published_by_user_id: userId }).eq('id', iapId);
    if (iapRow) {
      const periodId = (iapRow as any).operational_period_id as string;
      const { data: existing } = await supabase.from('iap_forms_hics252').select('id').eq('operational_period_id', periodId).maybeSingle();
      const sigPayload = { iap_signature_captured: true, iap_signature_data: signatureData, approved_at: new Date().toISOString(), approved_by_incident_commander_user_id: userId };
      if (existing) {
        await supabase.from('iap_forms_hics252').update(sigPayload).eq('id', (existing as any).id);
      } else {
        await supabase.from('iap_forms_hics252').insert({ operational_period_id: periodId, generated_at: new Date().toISOString(), ...sigPayload });
      }
    }
    return { data: null };
  },

  archive: async (iapId: string) => {
    await supabase.from('iaps').update({ status: 'ARCHIVED' }).eq('id', iapId);
    return { data: null };
  },

  assignReviewer: async (iapId: string, reviewerUserId: string) => {
    const userId = await getCurrentUserId();
    const { data } = await supabase.from('iap_review_assignments').insert({ iap_id: iapId, assigned_to_user_id: reviewerUserId, assigned_by_user_id: userId, assigned_at: new Date().toISOString() }).select().maybeSingle();
    return { data };
  },

  addComment: async (iapId: string, dto: { body: string; formReference?: string | null; parentId?: string | null }) => {
    const userId = await getCurrentUserId();
    const { data } = await supabase.from('iap_comments').insert({ iap_id: iapId, comment_text: dto.body, form_reference: dto.formReference ?? null, parent_comment_id: dto.parentId ?? null, author_user_id: userId }).select().maybeSingle();
    return { data };
  },

  resolveComment: async (iapId: string, commentId: string) => {
    const userId = await getCurrentUserId();
    const { data } = await supabase.from('iap_comments').update({ is_resolved: true, resolved_by_user_id: userId, resolved_at: new Date().toISOString() }).eq('id', commentId).select().maybeSingle();
    return { data };
  },

  requestExport: async (_iapId: string, _formNumbers?: string[]) => {
    return { data: { exportJobId: '', status: 'NOT_AVAILABLE' } };
  },

  getExportJob: async (_iapId: string, exportJobId: string) => {
    return { data: { id: exportJobId, status: 'NOT_AVAILABLE', downloadUrl: null, fileSizeBytes: null } };
  },

  listMessages213: async (facilityId: string, incidentId: string, params?: { page?: number; limit?: number }) => {
    const page = params?.page ?? 1;
    const limit = params?.limit ?? 50;
    const from = (page - 1) * limit;
    const { data, error } = await supabase
      .from('iap_forms_213')
      .select('*')
      .order('created_at', { ascending: false })
      .range(from, from + limit - 1);
    if (error) throw error;
    return { data: data ?? [] };
  },

  createMessage213: async (facilityId: string, incidentId: string, formData: Record<string, unknown>) => {
    const userId = await getCurrentUserId();
    const { data, error } = await supabase
      .from('iap_forms_213')
      .insert({ ...formData, created_by: userId })
      .select()
      .maybeSingle();
    if (error) throw error;
    return { data };
  },
};
