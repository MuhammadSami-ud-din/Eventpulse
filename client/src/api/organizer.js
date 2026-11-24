import { api } from './client.js';

export const fetchManagedEvents = (params, { signal } = {}) =>
  api.get('/organizer/events', { params, signal }).then((res) => res.data);

export const fetchManagedEvent = (id, { signal } = {}) =>
  api.get(`/organizer/events/${id}`, { signal }).then((res) => res.data.event);

export const createEvent = (fields) => api.post('/organizer/events', fields).then((res) => res.data.event);
export const updateEvent = (id, fields) => api.patch(`/organizer/events/${id}`, fields).then((res) => res.data.event);
export const deleteEvent = (id) => api.delete(`/organizer/events/${id}`);
export const publishEvent = (id) => api.post(`/organizer/events/${id}/publish`).then((res) => res.data.event);
export const closeEvent = (id) => api.post(`/organizer/events/${id}/close`).then((res) => res.data.event);

// Days in the chart are counted in this browser's time zone.
export const fetchEventStats = (id, { signal } = {}) =>
  api
    .get(`/organizer/events/${id}/stats`, { params: { utcOffsetMinutes: -new Date().getTimezoneOffset() }, signal })
    .then((res) => res.data.stats);

export const fetchEventRegistrations = (id, params, { signal } = {}) =>
  api.get(`/organizer/events/${id}/registrations`, { params, signal }).then((res) => res.data);

export const exportRegistrationsCsv = (id) =>
  api.get(`/organizer/events/${id}/registrations/export`, { responseType: 'blob' });

export const checkInTicket = (id, code) =>
  api.post(`/organizer/events/${id}/check-in`, { code }).then((res) => res.data);

export const markAttendance = (eventId, registrationId, status) =>
  api
    .put(`/organizer/events/${eventId}/registrations/${registrationId}/attendance`, { status })
    .then((res) => res.data.attendance);

export const markRemainingNoShows = (id) =>
  api.post(`/organizer/events/${id}/attendance/no-shows`).then((res) => res.data.markedNoShow);
