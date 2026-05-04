import { supabase } from '../lib/supabase';

export interface Notification {
  id: string;
  type: string;
  title: string;
  body: string;
  actionUrl?: string | null;
  readAt?: string | null;
  createdAt: string;
}

async function getCurrentAppUserId(): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) return null;
  const { data } = await supabase.from('app_users').select('id').eq('email', user.email).maybeSingle();
  return (data as { id: string } | null)?.id ?? null;
}

function toNotification(r: Record<string, unknown>): Notification {
  return {
    id: r.id as string,
    type: r.type as string,
    title: r.title as string,
    body: r.body as string,
    actionUrl: r.action_url as string | null,
    readAt: r.read_at as string | null,
    createdAt: r.created_at as string,
  };
}

export const notificationsApi = {
  list: async (params?: { unread?: boolean; page?: number; limit?: number }): Promise<{ data: { data: Notification[]; pagination: any } }> => {
    const userId = await getCurrentAppUserId();
    if (!userId) return { data: { data: [], pagination: { page: 1, limit: 20, total: 0, totalPages: 0 } } };
    const page = params?.page ?? 1;
    const limit = params?.limit ?? 20;
    const from = (page - 1) * limit;
    let q = supabase.from('notifications').select('*', { count: 'exact' }).eq('recipient_user_id', userId).order('created_at', { ascending: false }).range(from, from + limit - 1);
    if (params?.unread) q = q.eq('is_read', false);
    const { data, error, count } = await q;
    if (error) throw error;
    const total = count ?? 0;
    return { data: { data: (data ?? []).map(r => toNotification(r as any)), pagination: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 } } };
  },

  unreadCount: async (): Promise<{ data: { count: number } }> => {
    const userId = await getCurrentAppUserId();
    if (!userId) return { data: { count: 0 } };
    const { count, error } = await supabase.from('notifications').select('*', { count: 'exact', head: true }).eq('recipient_user_id', userId).eq('is_read', false);
    if (error) throw error;
    return { data: { count: count ?? 0 } };
  },

  markRead: async (id: string) => {
    const { error } = await supabase.from('notifications').update({ is_read: true, read_at: new Date().toISOString() }).eq('id', id);
    if (error) throw error;
    return { data: null };
  },

  markAllRead: async () => {
    const userId = await getCurrentAppUserId();
    if (!userId) return { data: null };
    const { error } = await supabase.from('notifications').update({ is_read: true, read_at: new Date().toISOString() }).eq('recipient_user_id', userId).eq('is_read', false);
    if (error) throw error;
    return { data: null };
  },
};
