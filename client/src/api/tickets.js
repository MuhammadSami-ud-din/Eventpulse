import { api } from './client.js';

export const fetchTicketStatus = (code, { signal } = {}) =>
  api.get(`/tickets/${encodeURIComponent(code)}`, { signal }).then((res) => res.data.ticket);
