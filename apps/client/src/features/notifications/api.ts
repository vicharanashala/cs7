// HTTP calls for the notification bell: list feed, unread count, mark one/all read.
import type { ApiSuccess, PublicNotification } from '@samagama/shared';
import { apiClient } from '../../lib/api-client';

export const notificationsApi = {
  async list(): Promise<PublicNotification[]> {
    const res = await apiClient.get<ApiSuccess<PublicNotification[]>>('/api/notifications');
    return res.data.data;
  },

  async getUnreadCount(): Promise<number> {
    const res = await apiClient.get<ApiSuccess<{ count: number }>>(
      '/api/notifications/unread-count',
    );
    return res.data.data.count;
  },

  async markRead(id: string): Promise<void> {
    await apiClient.patch(`/api/notifications/${id}/read`);
  },

  async markAllRead(): Promise<void> {
    await apiClient.patch('/api/notifications/read-all');
  },
};
