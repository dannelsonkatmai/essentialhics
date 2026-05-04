import { supabase } from '../lib/supabase';

export interface IapTemplate {
  id: string;
  name: string;
  description?: string | null;
  facilityId?: string | null;
  parentTemplateId?: string | null;
  parentTemplate?: { id: string; name: string } | null;
  formDefaults?: Array<{ formNumber: string; defaults: Record<string, unknown> }>;
  _count?: { formDefaults: number };
}

async function getCurrentAppUserId(): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) return null;
  const { data } = await supabase.from('app_users').select('id').eq('email', user.email).maybeSingle();
  return (data as { id: string } | null)?.id ?? null;
}

function toTemplate(r: Record<string, unknown>): IapTemplate {
  const defaults = (r.iap_template_form_defaults as any[]) ?? [];
  const parent = r.iap_templates as Record<string, unknown> | null;
  return {
    id: r.id as string,
    name: r.name as string,
    description: r.description as string | null,
    facilityId: r.facility_id as string | null,
    parentTemplateId: r.parent_template_id as string | null,
    parentTemplate: parent ? { id: parent.id as string, name: parent.name as string } : null,
    formDefaults: defaults.map((d: any) => ({ formNumber: d.form_number, defaults: d.default_values ?? {} })),
    _count: { formDefaults: defaults.length },
  };
}

export const templatesApi = {
  list: async (facilityId?: string): Promise<{ data: IapTemplate[] }> => {
    let q = supabase.from('iap_templates').select('*, iap_template_form_defaults(*), iap_templates!parent_template_id(id, name)').eq('is_deleted', false).eq('is_active', true).order('name');
    if (facilityId) q = q.or(`facility_id.eq.${facilityId},is_system_default.eq.true`);
    const { data, error } = await q;
    if (error) throw error;
    return { data: (data ?? []).map(r => toTemplate(r as any)) };
  },

  get: async (id: string): Promise<{ data: IapTemplate }> => {
    const { data, error } = await supabase.from('iap_templates').select('*, iap_template_form_defaults(*), iap_templates!parent_template_id(id, name)').eq('id', id).maybeSingle();
    if (error) throw error;
    return { data: toTemplate(data as any) };
  },

  resolve: async (id: string): Promise<{ data: Record<string, Record<string, unknown>> }> => {
    const { data, error } = await supabase.from('iap_template_form_defaults').select('form_number, default_values').eq('template_id', id);
    if (error) throw error;
    const resolved: Record<string, Record<string, unknown>> = {};
    (data ?? []).forEach((r: any) => { resolved[r.form_number] = r.default_values ?? {}; });
    return { data: resolved };
  },

  create: async (dto: Partial<IapTemplate>): Promise<{ data: IapTemplate }> => {
    const userId = await getCurrentAppUserId();
    const { data, error } = await supabase.from('iap_templates').insert({
      name: dto.name,
      description: dto.description ?? null,
      facility_id: dto.facilityId ?? null,
      parent_template_id: dto.parentTemplateId ?? null,
      is_active: true,
      is_system_default: false,
      version: 1,
      created_by: userId,
      last_modified_by: userId,
    }).select('*, iap_template_form_defaults(*)').maybeSingle();
    if (error) throw error;
    return { data: toTemplate(data as any) };
  },

  update: async (id: string, dto: Partial<IapTemplate>): Promise<{ data: IapTemplate }> => {
    const userId = await getCurrentAppUserId();
    const updates: Record<string, unknown> = { last_modified_by: userId };
    if (dto.name !== undefined) updates.name = dto.name;
    if (dto.description !== undefined) updates.description = dto.description;
    const { data, error } = await supabase.from('iap_templates').update(updates).eq('id', id).select('*, iap_template_form_defaults(*)').maybeSingle();
    if (error) throw error;
    return { data: toTemplate(data as any) };
  },

  delete: async (id: string) => {
    const { error } = await supabase.from('iap_templates').update({ is_deleted: true, deleted_at: new Date().toISOString() }).eq('id', id);
    if (error) throw error;
    return { data: null };
  },

  duplicate: async (id: string, name: string): Promise<{ data: IapTemplate }> => {
    const userId = await getCurrentAppUserId();
    const { data: source } = await supabase.from('iap_templates').select('*, iap_template_form_defaults(*)').eq('id', id).maybeSingle();
    if (!source) throw new Error('Template not found');
    const { data: copy, error } = await supabase.from('iap_templates').insert({
      name, description: (source as any).description, facility_id: (source as any).facility_id,
      parent_template_id: id, is_active: true, is_system_default: false, version: 1, created_by: userId, last_modified_by: userId,
    }).select().maybeSingle();
    if (error) throw error;
    const defaults = (source as any).iap_template_form_defaults ?? [];
    if (defaults.length > 0 && copy) {
      await supabase.from('iap_template_form_defaults').insert(defaults.map((d: any) => ({ template_id: (copy as any).id, form_number: d.form_number, default_values: d.default_values })));
    }
    return { data: toTemplate(copy as any) };
  },

  listObjectives: async (facilityId?: string) => {
    let q = supabase.from('objectives_bank').select('*').eq('is_deleted', false).eq('is_active', true).order('usage_count', { ascending: false });
    if (facilityId) q = q.or(`facility_id.eq.${facilityId},facility_id.is.null`);
    const { data, error } = await q;
    if (error) throw error;
    return { data: data ?? [] };
  },

  createObjective: async (dto: { objectiveText: string; priority: string; tags?: string[]; facilityId?: string }) => {
    const userId = await getCurrentAppUserId();
    const { data, error } = await supabase.from('objectives_bank').insert({
      objective_text: dto.objectiveText, priority: dto.priority, tags: dto.tags ?? [],
      facility_id: dto.facilityId ?? null, is_active: true, usage_count: 0, created_by: userId,
    }).select().maybeSingle();
    if (error) throw error;
    return { data };
  },

  useObjective: async (id: string) => {
    const { data: r } = await supabase.from('objectives_bank').select('usage_count').eq('id', id).maybeSingle();
    await supabase.from('objectives_bank').update({ usage_count: ((r as any)?.usage_count ?? 0) + 1 }).eq('id', id);
    return { data: null };
  },

  listTactics: async (facilityId?: string) => {
    let q = supabase.from('tactics_bank').select('*').eq('is_deleted', false).eq('is_active', true).order('usage_count', { ascending: false });
    if (facilityId) q = q.or(`facility_id.eq.${facilityId},facility_id.is.null`);
    const { data, error } = await q;
    if (error) throw error;
    return { data: data ?? [] };
  },

  createTactic: async (dto: { tacticText: string; tags?: string[]; facilityId?: string }) => {
    const userId = await getCurrentAppUserId();
    const { data, error } = await supabase.from('tactics_bank').insert({
      tactic_text: dto.tacticText, tags: dto.tags ?? [],
      facility_id: dto.facilityId ?? null, is_active: true, usage_count: 0, created_by: userId,
    }).select().maybeSingle();
    if (error) throw error;
    return { data };
  },

  useTactic: async (id: string) => {
    const { data: r } = await supabase.from('tactics_bank').select('usage_count').eq('id', id).maybeSingle();
    await supabase.from('tactics_bank').update({ usage_count: ((r as any)?.usage_count ?? 0) + 1 }).eq('id', id);
    return { data: null };
  },
};
