import { supabase } from '../lib/supabase';
import type { Facility, Department, PaginatedResponse, User } from '../types';

function toFacility(r: Record<string, unknown>): Facility {
  return {
    id: r.id as string,
    name: r.name as string,
    shortName: r.short_name as string,
    address: (r.address as Facility['address']) ?? { street: '', city: '', state: '', zip: '' },
    phone: r.phone as string | undefined,
    fax: r.fax as string | undefined,
    licenseNumber: r.license_number as string | undefined,
    facilityType: r.facility_type as Facility['facilityType'],
    isActive: r.is_active as boolean,
    timezone: r.timezone as string,
    emergencyContactName: r.emergency_contact_name as string | undefined,
    emergencyContactPhone: r.emergency_contact_phone as string | undefined,
    createdAt: r.created_at as string,
    departments: (r.departments as Department[] | undefined),
  };
}

function toDepartment(r: Record<string, unknown>): Department {
  return {
    id: r.id as string,
    facilityId: r.facility_id as string,
    name: r.name as string,
    code: r.code as string,
    parentDepartmentId: r.parent_department_id as string | undefined,
    isActive: r.is_active as boolean,
  };
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
    authProvider: (r.auth_provider as User['authProvider']) ?? 'LOCAL',
    isActive: r.is_active as boolean,
    isLocked: r.is_locked as boolean,
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
    })),
  };
}

export const facilitiesApi = {
  list: async (): Promise<{ data: Facility[] }> => {
    const { data, error } = await supabase.from('facilities').select('*').eq('is_deleted', false).eq('is_active', true).order('name');
    if (error) throw error;
    return { data: (data ?? []).map(r => toFacility(r as any)) };
  },

  get: async (id: string): Promise<{ data: Facility }> => {
    const { data, error } = await supabase.from('facilities').select('*, departments(*)').eq('id', id).maybeSingle();
    if (error) throw error;
    return { data: toFacility(data as any) };
  },

  create: async (body: Partial<Facility>): Promise<{ data: Facility }> => {
    const { data, error } = await supabase.from('facilities').insert({
      name: body.name,
      short_name: body.shortName,
      address: body.address ?? null,
      phone: body.phone ?? null,
      fax: body.fax ?? null,
      license_number: body.licenseNumber ?? null,
      facility_type: body.facilityType ?? 'HOSPITAL',
      is_active: true,
      timezone: body.timezone ?? 'America/New_York',
      emergency_contact_name: body.emergencyContactName ?? null,
      emergency_contact_phone: body.emergencyContactPhone ?? null,
    }).select().maybeSingle();
    if (error) throw error;
    return { data: toFacility(data as any) };
  },

  update: async (id: string, body: Partial<Facility>): Promise<{ data: Facility }> => {
    const updates: Record<string, unknown> = {};
    if (body.name !== undefined) updates.name = body.name;
    if (body.shortName !== undefined) updates.short_name = body.shortName;
    if (body.address !== undefined) updates.address = body.address;
    if (body.phone !== undefined) updates.phone = body.phone;
    if (body.fax !== undefined) updates.fax = body.fax;
    if (body.licenseNumber !== undefined) updates.license_number = body.licenseNumber;
    if (body.facilityType !== undefined) updates.facility_type = body.facilityType;
    if (body.isActive !== undefined) updates.is_active = body.isActive;
    if (body.timezone !== undefined) updates.timezone = body.timezone;
    if (body.emergencyContactName !== undefined) updates.emergency_contact_name = body.emergencyContactName;
    if (body.emergencyContactPhone !== undefined) updates.emergency_contact_phone = body.emergencyContactPhone;
    const { data, error } = await supabase.from('facilities').update(updates).eq('id', id).select().maybeSingle();
    if (error) throw error;
    return { data: toFacility(data as any) };
  },

  getDepartments: async (id: string): Promise<{ data: Department[] }> => {
    const { data, error } = await supabase.from('departments').select('*').eq('facility_id', id).eq('is_deleted', false).order('name');
    if (error) throw error;
    return { data: (data ?? []).map(r => toDepartment(r as any)) };
  },

  createDepartment: async (facilityId: string, body: Partial<Department>): Promise<{ data: Department }> => {
    const { data, error } = await supabase.from('departments').insert({
      facility_id: facilityId,
      name: body.name,
      code: body.code,
      parent_department_id: body.parentDepartmentId ?? null,
      is_active: true,
    }).select().maybeSingle();
    if (error) throw error;
    return { data: toDepartment(data as any) };
  },

  getUsers: async (id: string, params?: { page?: number; limit?: number }): Promise<{ data: PaginatedResponse<{ user: User; hicsRole: string }> }> => {
    const page = params?.page ?? 1;
    const limit = params?.limit ?? 50;
    const from = (page - 1) * limit;
    const { data, error, count } = await supabase
      .from('user_facility_roles')
      .select('*, app_users(*)', { count: 'exact' })
      .eq('facility_id', id)
      .eq('is_deleted', false)
      .range(from, from + limit - 1);
    if (error) throw error;
    const total = count ?? 0;
    const mapped = (data ?? []).map((r: any) => ({ user: toUser(r.app_users as any), hicsRole: r.hics_role }));
    return { data: { data: mapped, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 } } };
  },

  createUser: async (facilityId: string, body: Record<string, unknown>) => {
    // Create the app_user record; auth account creation requires the edge function
    const { data, error } = await supabase.from('app_users').insert({
      email: body.email,
      first_name: body.firstName,
      last_name: body.lastName,
      display_name: body.displayName ?? null,
      job_title: body.jobTitle ?? null,
      employee_id: body.employeeId ?? null,
      phone_mobile: body.phoneMobile ?? null,
      is_active: true,
      must_change_password: true,
      auth_provider: 'LOCAL',
    }).select().maybeSingle();
    if (error) throw error;
    // Assign facility role if provided
    if (body.hicsRole && data) {
      await supabase.from('user_facility_roles').insert({ user_id: (data as any).id, facility_id: facilityId, hics_role: body.hicsRole, is_primary_facility: true, assigned_at: new Date().toISOString() });
    }
    return { data };
  },

  importUsers: async (facilityId: string, file: File) => {
    // CSV import - parse and insert
    const text = await file.text();
    const lines = text.split('\n').filter(l => l.trim());
    const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
    const rows = lines.slice(1).map(line => {
      const cols = line.split(',').map(c => c.trim().replace(/^"|"$/g, ''));
      return Object.fromEntries(headers.map((h, i) => [h, cols[i] ?? '']));
    });
    const inserts = rows.filter(r => r.email).map(r => ({
      email: r.email, first_name: r.firstname || r.first_name || '', last_name: r.lastname || r.last_name || '',
      job_title: r.jobtitle || r.job_title || null, is_active: true, must_change_password: true, auth_provider: 'LOCAL',
    }));
    const { data, error } = await supabase.from('app_users').insert(inserts).select();
    if (error) throw error;
    return { data: { created: (data ?? []).length, skipped: 0 } };
  },

  getPositions: async (id: string) => {
    const { data, error } = await supabase.from('positions').select('*').eq('facility_id', id).eq('is_deleted', false).order('hics_role');
    if (error) throw error;
    return { data: data ?? [] };
  },

  getSettings: async () => {
    const { data, error } = await supabase.from('health_systems').select('*').limit(1).maybeSingle();
    if (error) throw error;
    return { data: data ?? {} };
  },

  updateSettings: async (body: object) => {
    const { data: existing } = await supabase.from('health_systems').select('id').limit(1).maybeSingle();
    if (!existing) return { data: null };
    const { data, error } = await supabase.from('health_systems').update(body).eq('id', (existing as any).id).select().maybeSingle();
    if (error) throw error;
    return { data };
  },
};
