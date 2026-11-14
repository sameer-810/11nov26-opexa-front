import { api } from '../../../shared/api/apiClient';

export type AppNotification = { id: string; type: string; title: string; body: string; link: string | null; read: boolean; createdAt: string };

export const notificationApi = {
  list: () => api<{ items: AppNotification[]; unread: number }>('/notifications'),
  read: (id: string) => api<{ updated: number }>(`/notifications/${id}/read`, { method: 'POST' }),
  readAll: () => api<{ updated: number }>('/notifications/read-all', { method: 'POST' }),
};
