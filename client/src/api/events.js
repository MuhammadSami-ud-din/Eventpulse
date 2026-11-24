import { api } from './client.js';

export const fetchCategories = ({ signal } = {}) =>
  api.get('/categories', { signal }).then((res) => res.data.data);

export const fetchEvents = (params, { signal } = {}) =>
  api.get('/events', { params, signal }).then((res) => res.data);

export const fetchEvent = (id, { signal } = {}) =>
  api.get(`/events/${id}`, { signal }).then((res) => res.data.event);
