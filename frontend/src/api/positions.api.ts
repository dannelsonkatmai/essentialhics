import { supabase } from '../lib/supabase';

export interface PositionAssignment {
  id: string;
  incidentId: string;
  hicsRole: string;
  isActive: boolean;
  assignedAt: string;
  relievedAt?: string | null;
  assignedUser?: { id: string; firstName: string; lastName: string; email: string } | null;
}

function toAssignment(r: Record<string, unknown>): PositionAssignment {
  const user = r.app_users as Record<string, unknown> | null;
  return {
    id: r.id as string,
    incidentId: r.incident_id as string,
    hicsRole: r.hics_role as string,
    isActive: r.is_active as boolean,
    assignedAt: r.assigned_at as string,
    relievedAt: r.relieved_at as string | null,
    assignedUser: user ? { id: user.id as string, firstName: user.first_name as string, lastName: user.last_name as string, email: user.email as string } : null,
  };
}

async function getCurrentAppUserId(): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) return null;
  const { data } = await supabase.from('app_users').select('id').eq('email', user.email).maybeSingle();
  return (data as { id: string } | null)?.id ?? null;
}

export const positionsApi = {
  list: async (facilityId: string, incidentId: string): Promise<{ data: PositionAssignment[] }> => {
    const { data, error } = await supabase
      .from('incident_position_assignments')
      .select('*, app_users(id, first_name, last_name, email)')
      .eq('incident_id', incidentId)
      .eq('is_active', true)
      .order('hics_role');
    if (error) throw error;
    return { data: (data ?? []).map(r => toAssignment(r as any)) };
  },

  assign: async (facilityId: string, incidentId: string, dto: { hicsRole: string; userId: string }): Promise<{ data: PositionAssignment }> => {
    const assignerId = await getCurrentAppUserId();
    // Relieve any existing active assignment for this role
    await supabase.from('incident_position_assignments').update({ is_active: false, relieved_at: new Date().toISOString() }).eq('incident_id', incidentId).eq('hics_role', dto.hicsRole).eq('is_active', true);
    const { data, error } = await supabase.from('incident_position_assignments').insert({
      incident_id: incidentId,
      hics_role: dto.hicsRole,
      assigned_user_id: dto.userId,
      assigned_by_user_id: assignerId,
      assigned_at: new Date().toISOString(),
      is_active: true,
    }).select('*, app_users(id, first_name, last_name, email)').maybeSingle();
    if (error) throw error;
    return { data: toAssignment(data as any) };
  },

  relieve: async (facilityId: string, incidentId: string, assignmentId: string) => {
    const { error } = await supabase.from('incident_position_assignments').update({ is_active: false, relieved_at: new Date().toISOString() }).eq('id', assignmentId);
    if (error) throw error;
    return { data: null };
  },

  vacate: async (facilityId: string, incidentId: string, hicsRole: string) => {
    const { error } = await supabase.from('incident_position_assignments').update({ is_active: false, relieved_at: new Date().toISOString() }).eq('incident_id', incidentId).eq('hics_role', hicsRole).eq('is_active', true);
    if (error) throw error;
    return { data: null };
  },

  syncTo203: async (facilityId: string, incidentId: string, iapId: string) => {
    // Get active positions and save to IAP form 203
    const { data: assignments } = await supabase.from('incident_position_assignments').select('*, app_users(id, first_name, last_name, email)').eq('incident_id', incidentId).eq('is_active', true);
    const positionData: Record<string, unknown> = {};
    (assignments ?? []).forEach((a: any) => {
      if (a.app_users) {
        positionData[a.hics_role] = `${a.app_users.first_name} ${a.app_users.last_name}`;
      }
    });
    // Get the IAP's operational period
    const { data: iap } = await supabase.from('iaps').select('operational_period_id').eq('id', iapId).maybeSingle();
    if (iap) {
      const periodId = (iap as any).operational_period_id;
      const { data: existing } = await supabase.from('iap_forms_203').select('id').eq('operational_period_id', periodId).maybeSingle();
      if (existing) {
        await supabase.from('iap_forms_203').update({ position_assignments: positionData }).eq('id', (existing as any).id);
      } else {
        await supabase.from('iap_forms_203').insert({ operational_period_id: periodId, position_assignments: positionData });
      }
    }
    return { data: { synced: Object.keys(positionData).length } };
  },
};
