import { api } from './client.js';

export const registerForEvent = (eventId) =>
  api.post(`/events/${eventId}/registrations`).then((res) => res.data.registration);

export const fetchMyRegistrations = (params, { signal } = {}) =>
  api.get('/me/registrations', { params, signal }).then((res) => res.data.data);

export const fetchMyRegistration = (id, { signal } = {}) =>
  api.get(`/me/registrations/${id}`, { signal }).then((res) => res.data.registration);

export const cancelRegistration = (id) =>
  api.post(`/me/registrations/${id}/cancel`).then((res) => res.data.registration);

// Fetched through axios (not a plain <img src>) so an expired session is
// refreshed transparently; the caller turns the blob into an object URL.
export const fetchTicketQr = (id, { signal } = {}) =>
  api.get(`/me/registrations/${id}/qr`, { responseType: 'blob', signal }).then((res) => res.data);
