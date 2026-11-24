import { api } from './client.js';

export const approveEvent = (id) => api.post(`/admin/events/${id}/approve`).then((res) => res.data.event);
export const rejectEvent = (id, reason) =>
  api.post(`/admin/events/${id}/reject`, { reason }).then((res) => res.data.event);

export const fetchUsers = (params, { signal } = {}) =>
  api.get('/admin/users', { params, signal }).then((res) => res.data);
