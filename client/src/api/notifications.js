import { api } from './client.js';

export const fetchNotifications = (params, { signal } = {}) =>
  api.get('/notifications', { params, signal }).then((res) => res.data);

export const fetchUnreadCount = () => api.get('/notifications/unread-count').then((res) => res.data.unreadCount);
export const markNotificationRead = (id) => api.post(`/notifications/${id}/read`).then((res) => res.data.unreadCount);
export const markAllNotificationsRead = () => api.post('/notifications/read-all').then((res) => res.data.unreadCount);
