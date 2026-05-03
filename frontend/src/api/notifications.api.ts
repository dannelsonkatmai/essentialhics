import api from './client';

export interface Notification {
  id: string;
  type: string;
  title: string;
  body: string;
  actionUrl?: string | null;
  readAt?: string | null;
  createdAt: string;
}

export const notificationsApi = {
  list: (params?: { unread?: boolean; page?: number; limit?: number }) =>
    api.get<{ data: Notification[]; pagination: any }>('/api/notifications', { params }),

  unreadCount: () =>
    api.get<{ count: number }>('/api/notifications/unread-count'),

  markRead: (id: string) =>
    api.post(`/api/notifications/${id}/read`),

  markAllRead: () =>
    api.post('/api/notifications/read-all'),
};
