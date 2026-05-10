import { supabase } from '../lib/supabase';

async function getCurrentAppUserId(): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) return null;
  const { data } = await supabase.from('app_users').select('id').eq('email', user.email).maybeSingle();
  return (data as { id: string } | null)?.id ?? null;
}

function toUser(u: any) {
  if (!u) return undefined;
  return { firstName: u.first_name ?? '', lastName: u.last_name ?? '', email: u.email ?? '' };
}

function toLineItem(li: any) {
  return {
    id: li.id,
    resourceDescription: li.resource_description,
    quantity: li.quantity,
    unit: li.unit ?? '',
    filledQuantity: li.filled_quantity ?? '0',
    estimatedUnitCost: li.estimated_unit_cost ?? undefined,
    estimatedTotalCost: li.estimated_total_cost ?? undefined,
    notes: li.notes ?? undefined,
    fulfillments: (li.request_fulfillments ?? []).map((f: any) => ({
      id: f.id,
      quantityFulfilled: f.quantity_fulfilled,
      fulfilledAt: f.fulfilled_at,
      notes: f.notes ?? undefined,
      fulfilledByUser: toUser(f.fulfilled_by) ?? { firstName: '', lastName: '' },
    })),
  };
}

function toRequest(r: Record<string, unknown>) {
  return {
    id: r.id,
    requestNumber: r.request_number,
    incidentId: r.incident_id,
    facilityId: r.facility_id,
    requestedByUserId: r.requested_by_user_id,
    priority: r.priority,
    status: r.status,
    missionAssignment: r.mission_assignment,
    requestedForRole: r.requested_for_role,
    requestedForSection: r.requested_for_section,
    deliveryLocation: r.delivery_location,
    deliveryBy: r.delivery_by,
    neededDate: r.needed_date,
    estimatedCost: r.estimated_cost,
    justification: r.justification,
    submittedAt: r.submitted_at,
    approvedAt: r.approved_at,
    approvedByUserId: r.approved_by_user_id,
    approvalNotes: r.approval_notes,
    deniedAt: r.denied_at,
    denialReason: r.denial_reason,
    cancelledAt: r.cancelled_at,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    lineItems: ((r.resource_request_line_items as any[]) ?? []).map(toLineItem),
    requestedByUser: toUser((r as any).requested_by),
    approvedByUser: toUser((r as any).approved_by),
  };
}

export const requestsApi = {
  list: async (facilityId: string, incidentId: string, params?: Record<string, string>) => {
    let q = supabase.from('resource_requests').select('*, resource_request_line_items(*)').eq('incident_id', incidentId).eq('is_deleted', false).order('created_at', { ascending: false });
    if (params?.status) q = q.eq('status', params.status);
    if (params?.priority) q = q.eq('priority', params.priority);
    const { data, error } = await q;
    if (error) throw error;
    return { data: (data ?? []).map(r => toRequest(r as any)) };
  },

  get: async (facilityId: string, incidentId: string, requestId: string) => {
    const { data, error } = await supabase
      .from('resource_requests')
      .select(`
        *,
        resource_request_line_items(
          *,
          request_fulfillments(
            id,
            quantity_fulfilled,
            fulfilled_at,
            notes,
            fulfilled_by:app_users!request_fulfillments_fulfilled_by_user_id_fkey(id, first_name, last_name, email)
          )
        ),
        requested_by:app_users!resource_requests_requested_by_user_id_fkey(id, first_name, last_name, email),
        approved_by:app_users!resource_requests_approved_by_user_id_fkey(id, first_name, last_name, email)
      `)
      .eq('id', requestId)
      .maybeSingle();
    if (error) throw error;
    return { data: toRequest(data as any) };
  },

  create: async (facilityId: string, incidentId: string, body: Record<string, unknown>) => {
    const userId = await getCurrentAppUserId();
    const { data, error } = await supabase.from('resource_requests').insert({
      incident_id: incidentId,
      facility_id: facilityId,
      requested_by_user_id: userId,
      priority: body.priority ?? 'ROUTINE',
      status: 'DRAFT',
      mission_assignment: body.missionAssignment ?? null,
      requested_for_role: body.requestedForRole ?? null,
      requested_for_section: body.requestedForSection ?? null,
      delivery_location: body.deliveryLocation ?? null,
      delivery_by: body.deliveryBy ?? null,
      needed_date: body.neededDate ?? null,
      estimated_cost: body.estimatedCost ?? null,
      justification: body.justification ?? null,
    }).select().maybeSingle();
    if (error) throw error;
    // Insert line items if provided
    if (body.lineItems && Array.isArray(body.lineItems) && data) {
      const items = (body.lineItems as any[]).map((li: any) => ({
        request_id: (data as any).id,
        resource_type_id: li.resourceTypeId ?? null,
        resource_description: li.resourceDescription,
        quantity: li.quantity,
        unit: li.unit ?? null,
        estimated_unit_cost: li.estimatedUnitCost ?? null,
        estimated_total_cost: li.estimatedTotalCost ?? null,
        notes: li.notes ?? null,
      }));
      await supabase.from('resource_request_line_items').insert(items);
    }
    return { data: toRequest(data as any) };
  },

  submit: async (facilityId: string, incidentId: string, requestId: string) => {
    const userId = await getCurrentAppUserId();
    const { data, error } = await supabase.from('resource_requests').update({ status: 'SUBMITTED', submitted_at: new Date().toISOString(), submitted_by_user_id: userId }).eq('id', requestId).select().maybeSingle();
    if (error) throw error;
    return { data: toRequest(data as any) };
  },

  approve: async (facilityId: string, incidentId: string, requestId: string, approvalNotes?: string) => {
    const userId = await getCurrentAppUserId();
    const { data, error } = await supabase.from('resource_requests').update({ status: 'APPROVED', approved_at: new Date().toISOString(), approved_by_user_id: userId, approval_notes: approvalNotes ?? null }).eq('id', requestId).select().maybeSingle();
    if (error) throw error;
    return { data: toRequest(data as any) };
  },

  deny: async (facilityId: string, incidentId: string, requestId: string, denialReason?: string) => {
    const userId = await getCurrentAppUserId();
    const { data, error } = await supabase.from('resource_requests').update({ status: 'DENIED', denied_at: new Date().toISOString(), denied_by_user_id: userId, denial_reason: denialReason ?? null }).eq('id', requestId).select().maybeSingle();
    if (error) throw error;
    return { data: toRequest(data as any) };
  },

  cancel: async (facilityId: string, incidentId: string, requestId: string) => {
    const userId = await getCurrentAppUserId();
    const { data, error } = await supabase.from('resource_requests').update({ status: 'CANCELLED', cancelled_at: new Date().toISOString(), cancelled_by_user_id: userId }).eq('id', requestId).select().maybeSingle();
    if (error) throw error;
    return { data: toRequest(data as any) };
  },

  fulfillLineItem: async (facilityId: string, incidentId: string, requestId: string, lineItemId: string, body: { quantityFulfilled: number; notes?: string; incidentResourceId?: string }) => {
    const userId = await getCurrentAppUserId();
    const { data, error } = await supabase.from('request_fulfillments').insert({
      line_item_id: lineItemId,
      incident_resource_id: body.incidentResourceId ?? null,
      quantity_fulfilled: body.quantityFulfilled,
      fulfilled_by_user_id: userId,
      fulfilled_at: new Date().toISOString(),
      notes: body.notes ?? null,
    }).select().maybeSingle();
    if (error) throw error;
    // Update filled_quantity on line item
    // Update filled_quantity on line item directly
    const { data: li } = await supabase.from('resource_request_line_items').select('filled_quantity').eq('id', lineItemId).maybeSingle();
    const current = Number((li as any)?.filled_quantity ?? 0);
    await supabase.from('resource_request_line_items').update({ filled_quantity: current + body.quantityFulfilled }).eq('id', lineItemId);
    return { data };
  },
};
