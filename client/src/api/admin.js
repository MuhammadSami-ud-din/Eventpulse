import { browserUtcOffsetMinutes } from '../utils/dateInput.js';
import { api } from './client.js';

export const approveEvent = (id) => api.post(`/admin/events/${id}/approve`).then((res) => res.data.event);
export const rejectEvent = (id, reason) =>
  api.post(`/admin/events/${id}/reject`, { reason }).then((res) => res.data.event);

export const fetchUsers = (params, { signal } = {}) =>
  api.get('/admin/users', { params, signal }).then((res) => res.data);
export const createAccount = (fields) => api.post('/admin/users', fields).then((res) => res.data.user);
export const changeUserRole = (id, role) => api.put(`/admin/users/${id}/role`, { role }).then((res) => res.data.user);
// Resolves to { user, releasedRegistrations }.
export const setUserActive = (id, isActive) =>
  api.put(`/admin/users/${id}/status`, { isActive }).then((res) => res.data);

export const fetchAdminCategories = ({ signal } = {}) =>
  api.get('/admin/categories', { signal }).then((res) => res.data.data);
export const createCategory = (fields) => api.post('/admin/categories', fields).then((res) => res.data.category);
export const updateCategory = (id, fields) =>
  api.put(`/admin/categories/${id}`, fields).then((res) => res.data.category);
export const deleteCategory = (id) => api.delete(`/admin/categories/${id}`);

// Months in the chart are calendar months in this browser's time zone.
export const fetchAnalytics = ({ signal } = {}) =>
  api.get('/admin/analytics', { params: { utcOffsetMinutes: browserUtcOffsetMinutes() }, signal }).then((res) => res.data);
