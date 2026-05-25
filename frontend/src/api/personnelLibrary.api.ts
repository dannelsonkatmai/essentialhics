import { supabase } from '../lib/supabase';
import type { PersonnelRecord, PersonnelRoster, PersonnelRosterMember, HicsRole, PaginatedResponse } from '../types';

export interface ListPersonnelParams {
  page?: number;
  limit?: number;
  search?: string;
  hicsRole?: HicsRole;
  status?: 'active' | 'inactive';
}

function toPersonnel(r: Record<string, unknown>): PersonnelRecord {
  return {
    id: r.id as string,
    facilityId: r.facility_id as string,
    firstName: r.first_name as string,
    lastName: r.last_name as string,
    title: r.title as string | undefined,
    defaultHicsRole: r.default_hics_role as HicsRole | undefined,
    phoneMobile: r.phone_mobile as string | undefined,
    phoneWork: r.phone_work as string | undefined,
    pagerNumber: r.pager_number as string | undefined,
    email: r.email as string | undefined,
    agency: r.agency as string | undefined,
    notes: r.notes as string | undefined,
    isActive: r.is_active as boolean,
    createdAt: r.created_at as string,
    updatedAt: r.updated_at as string,
  };
}

function toRoster(r: Record<string, unknown>): PersonnelRoster {
  const members = (r.facility_personnel_roster_members as any[] | undefined) ?? [];
  return {
    id: r.id as string,
    facilityId: r.facility_id as string,
    name: r.name as string,
    description: r.description as string | undefined,
    createdAt: r.created_at as string,
    updatedAt: r.updated_at as string,
    members: members.map((m: any): PersonnelRosterMember => ({
      id: m.id,
      rosterId: m.roster_id,
      personnelId: m.personnel_id,
      designatedHicsRole: m.designated_hics_role ?? undefined,
      sortOrder: m.sort_order,
      createdAt: m.created_at,
      personnel: m.facility_personnel ? toPersonnel(m.facility_personnel) : undefined,
    })),
  };
}

export const personnelLibraryApi = {
  // ── Personnel ──────────────────────────────────────────────────────────────

  list: async (facilityId: string, params?: ListPersonnelParams): Promise<{ data: PaginatedResponse<PersonnelRecord> }> => {
    const page = params?.page ?? 1;
    const limit = params?.limit ?? 50;
    const from = (page - 1) * limit;

    let q = supabase
      .from('facility_personnel')
      .select('*', { count: 'exact' })
      .eq('facility_id', facilityId)
      .eq('is_deleted', false)
      .order('last_name')
      .order('first_name')
      .range(from, from + limit - 1);

    if (params?.status === 'active') q = q.eq('is_active', true);
    if (params?.status === 'inactive') q = q.eq('is_active', false);
    if (params?.hicsRole) q = q.eq('default_hics_role', params.hicsRole);
    if (params?.search) {
      q = q.or(`first_name.ilike.%${params.search}%,last_name.ilike.%${params.search}%,email.ilike.%${params.search}%,agency.ilike.%${params.search}%`);
    }

    const { data, error, count } = await q;
    if (error) throw error;
    const total = count ?? 0;
    return {
      data: {
        data: (data ?? []).map(r => toPersonnel(r as any)),
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 },
      },
    };
  },

  listByRole: async (facilityId: string, hicsRole: HicsRole): Promise<{ data: PersonnelRecord[] }> => {
    const { data, error } = await supabase
      .from('facility_personnel')
      .select('*')
      .eq('facility_id', facilityId)
      .eq('is_deleted', false)
      .eq('is_active', true)
      .eq('default_hics_role', hicsRole)
      .order('last_name');
    if (error) throw error;
    return { data: (data ?? []).map(r => toPersonnel(r as any)) };
  },

  create: async (facilityId: string, body: Omit<PersonnelRecord, 'id' | 'facilityId' | 'createdAt' | 'updatedAt'>): Promise<{ data: PersonnelRecord }> => {
    const { data, error } = await supabase
      .from('facility_personnel')
      .insert({
        facility_id: facilityId,
        first_name: body.firstName,
        last_name: body.lastName,
        title: body.title ?? null,
        default_hics_role: body.defaultHicsRole ?? null,
        phone_mobile: body.phoneMobile ?? null,
        phone_work: body.phoneWork ?? null,
        pager_number: body.pagerNumber ?? null,
        email: body.email ?? null,
        agency: body.agency ?? null,
        notes: body.notes ?? null,
        is_active: body.isActive ?? true,
      })
      .select()
      .maybeSingle();
    if (error) throw error;
    return { data: toPersonnel(data as any) };
  },

  update: async (id: string, body: Partial<PersonnelRecord>): Promise<{ data: PersonnelRecord }> => {
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (body.firstName !== undefined) updates.first_name = body.firstName;
    if (body.lastName !== undefined) updates.last_name = body.lastName;
    if (body.title !== undefined) updates.title = body.title;
    if (body.defaultHicsRole !== undefined) updates.default_hics_role = body.defaultHicsRole;
    if (body.phoneMobile !== undefined) updates.phone_mobile = body.phoneMobile;
    if (body.phoneWork !== undefined) updates.phone_work = body.phoneWork;
    if (body.pagerNumber !== undefined) updates.pager_number = body.pagerNumber;
    if (body.email !== undefined) updates.email = body.email;
    if (body.agency !== undefined) updates.agency = body.agency;
    if (body.notes !== undefined) updates.notes = body.notes;
    if (body.isActive !== undefined) updates.is_active = body.isActive;

    const { data, error } = await supabase
      .from('facility_personnel')
      .update(updates)
      .eq('id', id)
      .select()
      .maybeSingle();
    if (error) throw error;
    return { data: toPersonnel(data as any) };
  },

  remove: async (id: string): Promise<{ data: null }> => {
    const { error } = await supabase
      .from('facility_personnel')
      .update({ is_deleted: true, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) throw error;
    return { data: null };
  },

  // ── Rosters ────────────────────────────────────────────────────────────────

  listRosters: async (facilityId: string): Promise<{ data: PersonnelRoster[] }> => {
    const { data, error } = await supabase
      .from('facility_personnel_rosters')
      .select(`
        *,
        facility_personnel_roster_members (
          *,
          facility_personnel (*)
        )
      `)
      .eq('facility_id', facilityId)
      .eq('is_deleted', false)
      .order('name');
    if (error) throw error;
    return { data: (data ?? []).map(r => toRoster(r as any)) };
  },

  createRoster: async (facilityId: string, body: { name: string; description?: string }): Promise<{ data: PersonnelRoster }> => {
    const { data, error } = await supabase
      .from('facility_personnel_rosters')
      .insert({ facility_id: facilityId, name: body.name, description: body.description ?? null })
      .select()
      .maybeSingle();
    if (error) throw error;
    return { data: toRoster(data as any) };
  },

  updateRoster: async (id: string, body: { name?: string; description?: string }): Promise<{ data: PersonnelRoster }> => {
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (body.name !== undefined) updates.name = body.name;
    if (body.description !== undefined) updates.description = body.description;
    const { data, error } = await supabase
      .from('facility_personnel_rosters')
      .update(updates)
      .eq('id', id)
      .select()
      .maybeSingle();
    if (error) throw error;
    return { data: toRoster(data as any) };
  },

  deleteRoster: async (id: string): Promise<{ data: null }> => {
    const { error } = await supabase
      .from('facility_personnel_rosters')
      .update({ is_deleted: true, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) throw error;
    return { data: null };
  },

  addRosterMember: async (rosterId: string, personnelId: string, designatedHicsRole?: HicsRole): Promise<{ data: null }> => {
    const { error } = await supabase
      .from('facility_personnel_roster_members')
      .insert({
        roster_id: rosterId,
        personnel_id: personnelId,
        designated_hics_role: designatedHicsRole ?? null,
      });
    if (error) throw error;
    return { data: null };
  },

  removeRosterMember: async (memberId: string): Promise<{ data: null }> => {
    const { error } = await supabase
      .from('facility_personnel_roster_members')
      .delete()
      .eq('id', memberId);
    if (error) throw error;
    return { data: null };
  },
};
