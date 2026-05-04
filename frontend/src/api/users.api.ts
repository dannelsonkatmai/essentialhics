import { supabase } from '../lib/supabase';
import type { User, PaginatedResponse } from '../types';

export interface ListUsersParams {
  page?: number;
  limit?: number;
  facilityId?: string;
  role?: string;
  status?: 'active' | 'inactive' | 'locked';
  search?: string;
}

function toUser(r: Record<string, unknown>): User {
  const roles = (r.user_facility_roles as any[]) ?? [];
  return {
    id: r.id as string,
    email: r.email as string,
    firstName: r.first_name as string,
    lastName: r.last_name as string,
    displayName: r.display_name as string | undefined,
    jobTitle: r.job_title as string | undefined,
    employeeId: r.employee_id as string | undefined,
    phoneMobile: r.phone_mobile as string | undefined,
    phoneWork: r.phone_work as string | undefined,
    pagerNumber: r.pager_number as string | undefined,
    authProvider: (r.auth_provider as User['authProvider']) ?? 'LOCAL',
    isActive: r.is_active as boolean,
    isLocked: r.is_locked as boolean,
    lastLoginAt: r.last_login_at as string | undefined,
    passwordChangedAt: r.password_changed_at as string | undefined,
    mustChangePassword: r.must_change_password as boolean,
    mfaEnabled: r.mfa_enabled as boolean,
    createdAt: r.created_at as string,
    updatedAt: r.updated_at as string,
    userFacilityRoles: roles.map((role: any) => ({
      id: role.id,
      facilityId: role.facility_id,
      hicsRole: role.hics_role,
      isPrimaryFacility: role.is_primary_facility,
      assignedAt: role.assigned_at,
      facility: role.facilities ? { name: role.facilities.name, shortName: role.facilities.short_name } : undefined,
    })),
  };
}

export const usersApi = {
  list: async (params?: ListUsersParams): Promise<{ data: PaginatedResponse<User> }> => {
    const page = params?.page ?? 1;
    const limit = params?.limit ?? 50;
    const from = (page - 1) * limit;

    let q = supabase
      .from('app_users')
      .select('*, user_facility_roles(*, facilities(name, short_name))', { count: 'exact' })
      .eq('is_deleted', false)
      .order('last_name')
      .range(from, from + limit - 1);

    if (params?.facilityId) {
      const { data: roleIds } = await supabase.from('user_facility_roles').select('user_id').eq('facility_id', params.facilityId).eq('is_deleted', false);
      const ids = (roleIds ?? []).map((r: any) => r.user_id);
      if (ids.length === 0) return { data: { data: [], pagination: { page, limit, total: 0, totalPages: 0 } } };
      q = q.in('id', ids);
    }
    if (params?.status === 'active') q = q.eq('is_active', true);
    if (params?.status === 'inactive') q = q.eq('is_active', false);
    if (params?.status === 'locked') q = q.eq('is_locked', true);
    if (params?.search) q = q.or(`email.ilike.%${params.search}%,first_name.ilike.%${params.search}%,last_name.ilike.%${params.search}%`);

    const { data, error, count } = await q;
    if (error) throw error;
    const total = count ?? 0;
    return { data: { data: (data ?? []).map(r => toUser(r as any)), pagination: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 } } };
  },

  get: async (id: string): Promise<{ data: User }> => {
    const { data, error } = await supabase.from('app_users').select('*, user_facility_roles(*, facilities(name, short_name))').eq('id', id).maybeSingle();
    if (error) throw error;
    return { data: toUser(data as any) };
  },

  update: async (id: string, body: Partial<User>): Promise<{ data: User }> => {
    const updates: Record<string, unknown> = {};
    if (body.firstName !== undefined) updates.first_name = body.firstName;
    if (body.lastName !== undefined) updates.last_name = body.lastName;
    if (body.displayName !== undefined) updates.display_name = body.displayName;
    if (body.jobTitle !== undefined) updates.job_title = body.jobTitle;
    if (body.employeeId !== undefined) updates.employee_id = body.employeeId;
    if (body.phoneMobile !== undefined) updates.phone_mobile = body.phoneMobile;
    if (body.phoneWork !== undefined) updates.phone_work = body.phoneWork;
    if (body.pagerNumber !== undefined) updates.pager_number = body.pagerNumber;
    const { data, error } = await supabase.from('app_users').update(updates).eq('id', id).select('*, user_facility_roles(*, facilities(name, short_name))').maybeSingle();
    if (error) throw error;
    return { data: toUser(data as any) };
  },

  deactivate: async (id: string) => {
    const { error } = await supabase.from('app_users').update({ is_active: false }).eq('id', id);
    if (error) throw error;
    return { data: null };
  },

  assignRole: async (id: string, body: { facilityId: string; hicsRole: string; isPrimaryFacility?: boolean }) => {
    const { data: current } = await supabase.auth.getUser();
    const { data: assigner } = await supabase.from('app_users').select('id').eq('email', current.user?.email ?? '').maybeSingle();
    const { data, error } = await supabase.from('user_facility_roles').insert({
      user_id: id,
      facility_id: body.facilityId,
      hics_role: body.hicsRole,
      is_primary_facility: body.isPrimaryFacility ?? false,
      assigned_by: (assigner as any)?.id ?? null,
      assigned_at: new Date().toISOString(),
    }).select().maybeSingle();
    if (error) throw error;
    return { data };
  },

  removeRole: async (id: string, roleId: string) => {
    const { error } = await supabase.from('user_facility_roles').update({ is_deleted: true, deleted_at: new Date().toISOString() }).eq('id', roleId);
    if (error) throw error;
    return { data: null };
  },

  revokeSession: async (userId: string, sessionId: string) => {
    // Sessions managed by Supabase Auth — mark as revoked in user_sessions if exists
    const { error } = await supabase.from('user_sessions').update({ revoked_at: new Date().toISOString() } as any).eq('id', sessionId).eq('user_id', userId);
    if (error) throw error;
    return { data: null };
  },
};
