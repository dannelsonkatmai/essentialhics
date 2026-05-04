import { supabase } from '../lib/supabase';

async function getCurrentAppUserId(): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) return null;
  const { data } = await supabase.from('app_users').select('id').eq('email', user.email).maybeSingle();
  return (data as { id: string } | null)?.id ?? null;
}

function toCostRecord(r: Record<string, unknown>) {
  return {
    id: r.id,
    incidentId: r.incident_id,
    operationalPeriodId: r.operational_period_id,
    costType: r.cost_type,
    femaCategory: r.fema_pa_category,
    description: r.description,
    quantity: r.quantity,
    unitCost: r.unit_cost,
    totalCost: r.total_cost,
    vendor: r.vendor,
    invoiceNumber: r.invoice_number,
    documentationUrl: r.documentation_url,
    incurredAt: r.incurred_at,
    recordedByUserId: r.recorded_by_user_id,
    isApproved: r.is_approved,
    approvedByUserId: r.approved_by_user_id,
    approvedAt: r.approved_at,
    notes: r.notes,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export const costsApi = {
  list: async (facilityId: string, incidentId: string, params?: Record<string, string>) => {
    let q = supabase.from('cost_records').select('*').eq('incident_id', incidentId).eq('is_deleted', false).order('incurred_at', { ascending: false });
    if (params?.operationalPeriodId) q = q.eq('operational_period_id', params.operationalPeriodId);
    if (params?.costType) q = q.eq('cost_type', params.costType);
    if (params?.isApproved !== undefined) q = q.eq('is_approved', params.isApproved === 'true');
    const { data, error } = await q;
    if (error) throw error;
    return { data: (data ?? []).map(r => toCostRecord(r as any)) };
  },

  get: async (facilityId: string, incidentId: string, costId: string) => {
    const { data, error } = await supabase.from('cost_records').select('*, labor_cost_records(*), equipment_cost_records(*)').eq('id', costId).maybeSingle();
    if (error) throw error;
    return { data: toCostRecord(data as any) };
  },

  create: async (facilityId: string, incidentId: string, body: Record<string, unknown>) => {
    const userId = await getCurrentAppUserId();
    const { data, error } = await supabase.from('cost_records').insert({
      incident_id: incidentId,
      operational_period_id: body.operationalPeriodId ?? null,
      cost_type: body.costType,
      fema_pa_category: body.femaCategory ?? null,
      description: body.description,
      quantity: body.quantity ?? 1,
      unit_cost: body.unitCost ?? 0,
      total_cost: body.totalCost ?? 0,
      vendor: body.vendor ?? null,
      invoice_number: body.invoiceNumber ?? null,
      documentation_url: body.documentationUrl ?? null,
      incurred_at: body.incurredAt ?? new Date().toISOString(),
      recorded_by_user_id: userId,
      notes: body.notes ?? null,
      is_approved: false,
    }).select().maybeSingle();
    if (error) throw error;
    return { data: toCostRecord(data as any) };
  },

  approve: async (facilityId: string, incidentId: string, costId: string) => {
    const userId = await getCurrentAppUserId();
    const { data, error } = await supabase.from('cost_records').update({ is_approved: true, approved_by_user_id: userId, approved_at: new Date().toISOString() }).eq('id', costId).select().maybeSingle();
    if (error) throw error;
    return { data: toCostRecord(data as any) };
  },

  delete: async (facilityId: string, incidentId: string, costId: string) => {
    const { error } = await supabase.from('cost_records').update({ is_deleted: true, deleted_at: new Date().toISOString() }).eq('id', costId);
    if (error) throw error;
    return { data: null };
  },

  getRollup: async (facilityId: string, incidentId: string, operationalPeriodId?: string) => {
    let q = supabase.from('cost_rollups').select('*').eq('incident_id', incidentId).order('computed_at', { ascending: false });
    if (operationalPeriodId) q = q.eq('operational_period_id', operationalPeriodId);
    const { data, error } = await q.limit(1).maybeSingle();
    if (error) throw error;
    return { data };
  },

  computeRollup: async (facilityId: string, incidentId: string) => {
    // Compute totals directly from cost_records
    const { data: records } = await supabase.from('cost_records').select('cost_type, total_cost, is_approved, fema_pa_category, operational_period_id').eq('incident_id', incidentId).eq('is_deleted', false);
    const rows = records ?? [];
    const total = rows.reduce((s: number, r: any) => s + Number(r.total_cost ?? 0), 0);
    const labor = rows.filter((r: any) => r.cost_type === 'LABOR').reduce((s: number, r: any) => s + Number(r.total_cost ?? 0), 0);
    const equipment = rows.filter((r: any) => r.cost_type === 'EQUIPMENT').reduce((s: number, r: any) => s + Number(r.total_cost ?? 0), 0);
    const supply = rows.filter((r: any) => r.cost_type === 'SUPPLY').reduce((s: number, r: any) => s + Number(r.total_cost ?? 0), 0);
    const contract = rows.filter((r: any) => r.cost_type === 'CONTRACT').reduce((s: number, r: any) => s + Number(r.total_cost ?? 0), 0);
    const overhead = rows.filter((r: any) => r.cost_type === 'OVERHEAD').reduce((s: number, r: any) => s + Number(r.total_cost ?? 0), 0);
    const approved = rows.filter((r: any) => r.is_approved).reduce((s: number, r: any) => s + Number(r.total_cost ?? 0), 0);
    const rollup = { incident_id: incidentId, computed_at: new Date().toISOString(), total_cost: total, labor_cost: labor, equipment_cost: equipment, supply_cost: supply, contract_cost: contract, overhead_cost: overhead, approved_cost: approved, unapproved_cost: total - approved, record_count: rows.length };
    await supabase.from('cost_rollups').insert(rollup);
    return { data: rollup };
  },

  exportFemaPA: async (facilityId: string, incidentId: string, opts?: { approvedOnly?: boolean; operationalPeriodId?: string }) => {
    return { data: { exportJobId: '', status: 'NOT_AVAILABLE' } };
  },

  exportPeriodPdf: async (facilityId: string, incidentId: string, operationalPeriodId: string) => {
    return { data: { exportJobId: '', status: 'NOT_AVAILABLE' } };
  },

  getExportJob: async (facilityId: string, incidentId: string, exportJobId: string) => {
    const { data, error } = await supabase.from('export_jobs').select('*').eq('id', exportJobId).maybeSingle();
    if (error) throw error;
    return { data };
  },
};

export const mutualAidApi = {
  list: async (facilityId: string) => {
    const { data, error } = await supabase.from('mutual_aid_agreements').select('*').eq('facility_id', facilityId).order('created_at', { ascending: false });
    if (error) throw error;
    return { data: data ?? [] };
  },

  get: async (facilityId: string, agreementId: string) => {
    const { data, error } = await supabase.from('mutual_aid_agreements').select('*').eq('id', agreementId).maybeSingle();
    if (error) throw error;
    return { data };
  },

  create: async (facilityId: string, body: Record<string, unknown>) => {
    const userId = await getCurrentAppUserId();
    const { data, error } = await supabase.from('mutual_aid_agreements').insert({ ...body, facility_id: facilityId, created_by: userId }).select().maybeSingle();
    if (error) throw error;
    return { data };
  },

  update: async (facilityId: string, agreementId: string, body: Record<string, unknown>) => {
    const { data, error } = await supabase.from('mutual_aid_agreements').update(body).eq('id', agreementId).select().maybeSingle();
    if (error) throw error;
    return { data };
  },
};
