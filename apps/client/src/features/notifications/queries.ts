// React Query hooks for notifications. The feed and unread badge poll every 30s so new
// notifications appear without a manual refresh; mutations invalidate both on success.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { notificationsApi } from './api';

// Centralized query keys so hooks and invalidations stay in sync.
export const notifKeys = {
  list: ['notifications', 'list'] as const,
  unreadCount: ['notifications', 'unread-count'] as const,
};

// Full notification feed, polled every 30s.
export function useNotifications() {
  return useQuery({
    queryKey: notifKeys.list,
    queryFn: notificationsApi.list,
    refetchInterval: 30_000,
  });
}

// Unread badge count, polled every 30s.
export function useUnreadCount() {
  return useQuery({
    queryKey: notifKeys.unreadCount,
    queryFn: notificationsApi.getUnreadCount,
    refetchInterval: 30_000,
  });
}

// Mark a single notification read, then refresh feed + badge.
export function useMarkRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => notificationsApi.markRead(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: notifKeys.list });
      void qc.invalidateQueries({ queryKey: notifKeys.unreadCount });
    },
  });
}

// Mark every notification read, then refresh feed + badge.
export function useMarkAllRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: notificationsApi.markAllRead,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: notifKeys.list });
      void qc.invalidateQueries({ queryKey: notifKeys.unreadCount });
    },
  });
}
