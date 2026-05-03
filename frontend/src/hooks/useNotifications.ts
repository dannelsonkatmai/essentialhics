import { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { notificationsApi, Notification } from '../api/notifications.api';
import { useSocket } from './useSocket';

export function useNotifications() {
  const queryClient = useQueryClient();
  const { on } = useSocket();

  const { data: unreadData } = useQuery({
    queryKey: ['notifications', 'unread-count'],
    queryFn: () => notificationsApi.unreadCount().then((r) => r.data),
    refetchInterval: 60_000, // poll every 60s as fallback
  });

  const { data: listData, isLoading } = useQuery({
    queryKey: ['notifications', 'list'],
    queryFn: () => notificationsApi.list({ limit: 25 }).then((r) => r.data),
  });

  const markReadMutation = useMutation({
    mutationFn: (id: string) => notificationsApi.markRead(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  const markAllReadMutation = useMutation({
    mutationFn: () => notificationsApi.markAllRead(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  // Live notifications via WebSocket
  useEffect(() => {
    const cleanup = on<Notification>('notification:new', (notification) => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    });
    return cleanup;
  }, [on, queryClient]);

  return {
    notifications: listData?.data ?? [],
    unreadCount: unreadData?.count ?? 0,
    isLoading,
    markRead: (id: string) => markReadMutation.mutate(id),
    markAllRead: () => markAllReadMutation.mutate(),
  };
}
