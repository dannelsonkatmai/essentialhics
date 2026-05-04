import { supabase } from '../lib/supabase';

export interface Incident {
  id: string;
  facilityId: string;
  incidentNumber: string;
  name: string;
  incidentType: string;
  status: 'PLANNING' | 'ACTIVE' | 'DEMOBILIZING' | 'CLOSED' | 'EXERCISED';
  severity: 'LEVEL_1' | 'LEVEL_2' | 'LEVEL_3';
  declarationTime: string;
  location?: string;
  description?: string;
  isExercise: boolean;
  incidentCommander?: { id: string; firstName: string; lastName: string } | null;
  _count?: { operationalPeriods: number };
}

export interface OperationalPeriod {
  id: string;
  incidentId: string;
  periodNumber: number;
  startTime: string;
  endTime: string;
  objectives?: string | null;
  status: string;
  iap?: { id: string; status: string; completenessScore: number } | null;
}

export interface CreateIncidentDto {
  name: string;
  incidentType: string;
  severity: string;
  declarationTime: string;
  location?: string;
  description?: string;
  isExercise: boolean;
  incidentCommanderId?: string;
}

function toIncident(row: Record<string, unknown>): Incident {
  return {
    id: row.id as string,
    facilityId: row.facility_id as string,
    incidentNumber: row.incident_number as string,
    name: row.name as string,
    incidentType: row.incident_type as string,
    status: row.status as Incident['status'],
    severity: row.severity as Incident['severity'],
    declarationTime: row.declaration_time as string,
    location: row.incident_location as string | undefined,
    description: row.situation_summary as string | undefined,
    isExercise: row.is_exercise as boolean,
    incidentCommander: null,
    _count: { operationalPeriods: 0 },
  };
}

function toOperationalPeriod(row: Record<string, unknown>): OperationalPeriod {
  return {
    id: row.id as string,
    incidentId: row.incident_id as string,
    periodNumber: row.period_number as number,
    startTime: row.start_time as string,
    endTime: row.end_time as string,
    objectives: undefined,
    status: row.status as string,
    iap: null,
  };
}

async function getMyUserRow(): Promise<{ id: string; health_system_id: string } | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) return null;
  const { data } = await supabase
    .from('users')
    .select('id, health_system_id')
    .eq('email', user.email)
    .maybeSingle();
  return data as { id: string; health_system_id: string } | null;
}

function generateIncidentNumber(): string {
  const now = new Date();
  const yy = String(now.getFullYear()).slice(-2);
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const seq = String(Math.floor(Math.random() * 9000) + 1000);
  return `INC-${yy}${mm}${dd}-${seq}`;
}

export const incidentsApi = {
  list: async (facilityId: string, params?: { status?: string; page?: number; limit?: number }) => {
    const page = params?.page ?? 1;
    const limit = params?.limit ?? 20;
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    let query = supabase
      .from('incidents')
      .select('*', { count: 'exact' })
      .eq('facility_id', facilityId)
      .eq('is_deleted', false)
      .order('declaration_time', { ascending: false })
      .range(from, to);

    if (params?.status) {
      query = query.eq('status', params.status);
    }

    const { data, error, count } = await query;
    if (error) throw error;

    const incidents = (data ?? []).map((r) => toIncident(r as Record<string, unknown>));
    const total = count ?? 0;
    return {
      data: {
        data: incidents,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      },
    };
  },

  get: async (facilityId: string, incidentId: string) => {
    const { data, error } = await supabase
      .from('incidents')
      .select('*')
      .eq('id', incidentId)
      .eq('facility_id', facilityId)
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new Error('Incident not found');
    return { data: toIncident(data as Record<string, unknown>) };
  },

  create: async (facilityId: string, dto: CreateIncidentDto) => {
    const userRow = await getMyUserRow();
    if (!userRow) throw new Error('User not found');

    // Map EXERCISE severity to LEVEL_3 + is_exercise flag
    let severity = dto.severity as 'LEVEL_1' | 'LEVEL_2' | 'LEVEL_3';
    let isExercise = dto.isExercise;
    if (dto.severity === 'EXERCISE') {
      severity = 'LEVEL_3';
      isExercise = true;
    }

    const { data, error } = await supabase
      .from('incidents')
      .insert({
        facility_id: facilityId,
        health_system_id: userRow.health_system_id,
        incident_number: generateIncidentNumber(),
        name: dto.name,
        incident_type: dto.incidentType,
        status: 'ACTIVE',
        severity,
        declaration_time: dto.declarationTime,
        incident_location: dto.location ?? null,
        situation_summary: dto.description ?? null,
        is_exercise: isExercise,
        created_by: userRow.id,
        incident_commander_id: dto.incidentCommanderId ?? null,
      })
      .select()
      .single();

    if (error) throw error;
    return { data: toIncident(data as Record<string, unknown>) };
  },

  update: async (facilityId: string, incidentId: string, dto: Partial<CreateIncidentDto>) => {
    const updates: Record<string, unknown> = {};
    if (dto.name !== undefined) updates.name = dto.name;
    if (dto.incidentType !== undefined) updates.incident_type = dto.incidentType;
    if (dto.severity !== undefined) updates.severity = dto.severity;
    if (dto.declarationTime !== undefined) updates.declaration_time = dto.declarationTime;
    if (dto.location !== undefined) updates.incident_location = dto.location;
    if (dto.description !== undefined) updates.situation_summary = dto.description;
    if (dto.isExercise !== undefined) updates.is_exercise = dto.isExercise;

    const { data, error } = await supabase
      .from('incidents')
      .update(updates)
      .eq('id', incidentId)
      .eq('facility_id', facilityId)
      .select()
      .single();

    if (error) throw error;
    return { data: toIncident(data as Record<string, unknown>) };
  },

  close: async (facilityId: string, incidentId: string) => {
    const { error } = await supabase
      .from('incidents')
      .update({ status: 'CLOSED', closed_at: new Date().toISOString() })
      .eq('id', incidentId)
      .eq('facility_id', facilityId);
    if (error) throw error;
    return { data: null };
  },

  listPeriods: async (facilityId: string, incidentId: string) => {
    const { data, error } = await supabase
      .from('operational_periods')
      .select('*')
      .eq('incident_id', incidentId)
      .order('period_number', { ascending: true });
    if (error) throw error;
    return { data: (data ?? []).map((r) => toOperationalPeriod(r as Record<string, unknown>)) };
  },

  createPeriod: async (facilityId: string, incidentId: string, dto: { startTime: string; endTime: string; objectives?: string }) => {
    const userRow = await getMyUserRow();
    if (!userRow) throw new Error('User not found');

    // Get next period number
    const { data: existing } = await supabase
      .from('operational_periods')
      .select('period_number')
      .eq('incident_id', incidentId)
      .order('period_number', { ascending: false })
      .limit(1);

    const nextPeriod = existing && existing.length > 0 ? (existing[0].period_number as number) + 1 : 1;

    const { data, error } = await supabase
      .from('operational_periods')
      .insert({
        incident_id: incidentId,
        period_number: nextPeriod,
        start_time: dto.startTime,
        end_time: dto.endTime,
        status: 'DRAFT',
        created_by: userRow.id,
      })
      .select()
      .single();

    if (error) throw error;
    return { data: toOperationalPeriod(data as Record<string, unknown>) };
  },

  activatePeriod: async (facilityId: string, incidentId: string, periodId: string) => {
    const { error } = await supabase
      .from('operational_periods')
      .update({ status: 'ACTIVE' })
      .eq('id', periodId)
      .eq('incident_id', incidentId);
    if (error) throw error;
    return { data: null };
  },
};
