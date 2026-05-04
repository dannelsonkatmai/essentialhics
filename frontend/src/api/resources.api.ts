import { supabase } from '../lib/supabase';

async function getCurrentAppUserId(): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) return null;
  const { data } = await supabase.from('app_users').select('id').eq('email', user.email).maybeSingle();
  return (data as { id: string } | null)?.id ?? null;
}

function toResource(r: Record<string, unknown>) {
  return {
    id: r.id,
    incidentId: r.incident_id,
    facilityId: r.facility_id,
    resourceTypeId: r.resource_type_id,
    name: r.name,
    nimsKind: r.nims_kind,
    quantity: r.quantity,
    unit: r.unit,
    source: r.source,
    status: r.status,
    resourceIdentifier: r.resource_identifier,
    homeBaseOrgName: r.home_base_org_name,
    homeBaseContact: r.home_base_contact,
    requestId: r.request_id,
    eta: r.eta,
    assignedToRole: r.assigned_to_role,
    assignedToLocation: r.assigned_to_location,
    costPerUnit: r.cost_per_unit,
    costUnitPeriod: r.cost_unit_period,
    orderedAt: r.ordered_at,
    assignedAt: r.assigned_at,
    availableAt: r.available_at,
    demobilizedAt: r.demobilized_at,
    notes: r.notes,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    resourceType: (r.resource_types as any) ?? null,
  };
}

function toResourceType(r: Record<string, unknown>) {
  return {
    id: r.id,
    facilityId: r.facility_id,
    nimsKind: r.nims_kind,
    name: r.name,
    description: r.description,
    unit: r.unit,
    category: r.category,
    defaultCostPerUnit: r.default_cost_per_unit,
    defaultCostUnitPeriod: r.default_cost_unit_period,
    isActive: r.is_active,
    createdAt: r.created_at,
  };
}

export const resourcesApi = {
  list: async (facilityId: string, incidentId: string, params?: Record<string, string>) => {
    let q = supabase.from('incident_resources').select('*, resource_types(id, name, nims_kind, category, unit)').eq('incident_id', incidentId).eq('is_deleted', false).order('created_at', { ascending: false });
    if (params?.status) q = q.eq('status', params.status);
    if (params?.nimsKind) q = q.eq('nims_kind', params.nimsKind);
    const { data, error } = await q;
    if (error) throw error;
    return { data: (data ?? []).map(r => toResource(r as any)) };
  },

  summary: async (facilityId: string, incidentId: string) => {
    const { data, error } = await supabase.from('incident_resources').select('status, nims_kind').eq('incident_id', incidentId).eq('is_deleted', false);
    if (error) throw error;
    const rows = data ?? [];
    const byStatus: Record<string, number> = {};
    const byKind: Record<string, number> = {};
    rows.forEach((r: any) => {
      byStatus[r.status] = (byStatus[r.status] ?? 0) + 1;
      byKind[r.nims_kind] = (byKind[r.nims_kind] ?? 0) + 1;
    });
    return { data: { total: rows.length, byStatus, byKind } };
  },

  get: async (facilityId: string, incidentId: string, resourceId: string) => {
    const { data, error } = await supabase.from('incident_resources').select('*, resource_types(*)').eq('id', resourceId).maybeSingle();
    if (error) throw error;
    return { data: toResource(data as any) };
  },

  create: async (facilityId: string, incidentId: string, body: Record<string, unknown>) => {
    const userId = await getCurrentAppUserId();
    const { data, error } = await supabase.from('incident_resources').insert({
      incident_id: incidentId,
      facility_id: facilityId,
      resource_type_id: body.resourceTypeId ?? null,
      name: body.name,
      nims_kind: body.nimsKind ?? 'PERSONNEL',
      quantity: body.quantity ?? 1,
      unit: body.unit ?? null,
      source: body.source ?? 'FACILITY',
      status: body.status ?? 'ORDERED',
      resource_identifier: body.resourceIdentifier ?? null,
      home_base_org_name: body.homeBaseOrgName ?? null,
      home_base_contact: body.homeBaseContact ?? null,
      eta: body.eta ?? null,
      cost_per_unit: body.costPerUnit ?? null,
      cost_unit_period: body.costUnitPeriod ?? null,
      notes: body.notes ?? null,
      created_by: userId,
    }).select().maybeSingle();
    if (error) throw error;
    return { data: toResource(data as any) };
  },

  update: async (facilityId: string, incidentId: string, resourceId: string, body: Record<string, unknown>) => {
    const updates: Record<string, unknown> = {};
    if (body.name !== undefined) updates.name = body.name;
    if (body.quantity !== undefined) updates.quantity = body.quantity;
    if (body.eta !== undefined) updates.eta = body.eta;
    if (body.notes !== undefined) updates.notes = body.notes;
    if (body.assignedToRole !== undefined) updates.assigned_to_role = body.assignedToRole;
    if (body.assignedToLocation !== undefined) updates.assigned_to_location = body.assignedToLocation;
    if (body.costPerUnit !== undefined) updates.cost_per_unit = body.costPerUnit;
    const { data, error } = await supabase.from('incident_resources').update(updates).eq('id', resourceId).select().maybeSingle();
    if (error) throw error;
    return { data: toResource(data as any) };
  },

  delete: async (facilityId: string, incidentId: string, resourceId: string) => {
    const { error } = await supabase.from('incident_resources').update({ is_deleted: true, deleted_at: new Date().toISOString() }).eq('id', resourceId);
    if (error) throw error;
    return { data: null };
  },

  transition: async (facilityId: string, incidentId: string, resourceId: string, body: { toStatus: string; location?: string; notes?: string; assignedToRole?: string; assignedToLocation?: string }) => {
    const userId = await getCurrentAppUserId();
    const { data: current } = await supabase.from('incident_resources').select('status').eq('id', resourceId).maybeSingle();
    const fromStatus = (current as any)?.status;
    const now = new Date().toISOString();
    const updates: Record<string, unknown> = { status: body.toStatus };
    if (body.assignedToRole) updates.assigned_to_role = body.assignedToRole;
    if (body.assignedToLocation) updates.assigned_to_location = body.assignedToLocation;
    if (body.toStatus === 'ASSIGNED') updates.assigned_at = now;
    if (body.toStatus === 'AVAILABLE') updates.available_at = now;
    if (body.toStatus === 'OUT_OF_SERVICE') updates.out_of_service_at = now;
    if (body.toStatus === 'DEMOBILIZED') updates.demobilized_at = now;
    const { data, error } = await supabase.from('incident_resources').update(updates).eq('id', resourceId).select().maybeSingle();
    if (error) throw error;
    await supabase.from('resource_status_history').insert({ incident_resource_id: resourceId, from_status: fromStatus, to_status: body.toStatus, changed_by_user_id: userId, changed_at: now, location: body.location ?? null, notes: body.notes ?? null });
    return { data: toResource(data as any) };
  },

  demobilize: async (facilityId: string, incidentId: string, resourceId: string, notes?: string) => {
    return resourcesApi.transition(facilityId, incidentId, resourceId, { toStatus: 'DEMOBILIZED', notes });
  },

  bulkCheckIn: async (facilityId: string, incidentId: string, resourceIds: string[], location?: string) => {
    const userId = await getCurrentAppUserId();
    const now = new Date().toISOString();
    const { error } = await supabase.from('incident_resources').update({ status: 'AVAILABLE', available_at: now }).in('id', resourceIds);
    if (error) throw error;
    const history = resourceIds.map(id => ({ incident_resource_id: id, from_status: 'IN_TRANSIT', to_status: 'AVAILABLE', changed_by_user_id: userId, changed_at: now, location: location ?? null }));
    await supabase.from('resource_status_history').insert(history);
    return { data: { updated: resourceIds.length } };
  },

  history: async (facilityId: string, incidentId: string, resourceId: string) => {
    const { data, error } = await supabase.from('resource_status_history').select('*').eq('incident_resource_id', resourceId).order('changed_at', { ascending: false });
    if (error) throw error;
    return { data: data ?? [] };
  },

  listTypes: async (facilityId: string, params?: Record<string, string>) => {
    let q = supabase.from('resource_types').select('*').eq('is_deleted', false).order('name');
    if (params?.category) q = q.eq('category', params.category);
    if (facilityId) q = q.or(`facility_id.eq.${facilityId},facility_id.is.null`);
    const { data, error } = await q;
    if (error) throw error;
    return { data: (data ?? []).map(r => toResourceType(r as any)) };
  },

  getType: async (facilityId: string, typeId: string) => {
    const { data, error } = await supabase.from('resource_types').select('*').eq('id', typeId).maybeSingle();
    if (error) throw error;
    return { data: toResourceType(data as any) };
  },

  createType: async (facilityId: string, body: Record<string, unknown>) => {
    const userId = await getCurrentAppUserId();
    const { data, error } = await supabase.from('resource_types').insert({
      facility_id: facilityId,
      nims_kind: body.nimsKind ?? 'EQUIPMENT',
      name: body.name,
      description: body.description ?? null,
      unit: body.unit ?? null,
      category: body.category ?? null,
      default_cost_per_unit: body.defaultCostPerUnit ?? null,
      default_cost_unit_period: body.defaultCostUnitPeriod ?? null,
      is_active: true,
      created_by: userId,
    }).select().maybeSingle();
    if (error) throw error;
    return { data: toResourceType(data as any) };
  },

  updateType: async (facilityId: string, typeId: string, body: Record<string, unknown>) => {
    const updates: Record<string, unknown> = {};
    if (body.name !== undefined) updates.name = body.name;
    if (body.description !== undefined) updates.description = body.description;
    if (body.unit !== undefined) updates.unit = body.unit;
    if (body.category !== undefined) updates.category = body.category;
    if (body.defaultCostPerUnit !== undefined) updates.default_cost_per_unit = body.defaultCostPerUnit;
    if (body.isActive !== undefined) updates.is_active = body.isActive;
    const { data, error } = await supabase.from('resource_types').update(updates).eq('id', typeId).select().maybeSingle();
    if (error) throw error;
    return { data: toResourceType(data as any) };
  },

  deleteType: async (facilityId: string, typeId: string) => {
    const { error } = await supabase.from('resource_types').update({ is_deleted: true, deleted_at: new Date().toISOString() }).eq('id', typeId);
    if (error) throw error;
    return { data: null };
  },

  getInventory: async (facilityId: string) => {
    const { data, error } = await supabase.from('facility_resource_inventory').select('*, resource_types(id, name, nims_kind, unit, category)').eq('facility_id', facilityId);
    if (error) throw error;
    return { data: data ?? [] };
  },

  upsertInventory: async (facilityId: string, resourceTypeId: string, body: Record<string, unknown>) => {
    const userId = await getCurrentAppUserId();
    const { data: existing } = await supabase.from('facility_resource_inventory').select('id').eq('facility_id', facilityId).eq('resource_type_id', resourceTypeId).maybeSingle();
    let result;
    if (existing) {
      const { data } = await supabase.from('facility_resource_inventory').update({ quantity_on_hand: body.quantityOnHand, quantity_available: body.quantityAvailable, storage_location: body.storageLocation ?? null, notes: body.notes ?? null, last_updated_by: userId }).eq('id', (existing as any).id).select().maybeSingle();
      result = data;
    } else {
      const { data } = await supabase.from('facility_resource_inventory').insert({ facility_id: facilityId, resource_type_id: resourceTypeId, quantity_on_hand: body.quantityOnHand, quantity_available: body.quantityAvailable, storage_location: body.storageLocation ?? null, notes: body.notes ?? null, last_updated_by: userId }).select().maybeSingle();
      result = data;
    }
    return { data: result };
  },
};
