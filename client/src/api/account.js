import { api } from './client.js';

export const fetchAccountSummary = ({ signal } = {}) =>
  api.get('/account/summary', { signal }).then((res) => res.data.summary);

// The image goes up as the raw request body; its Content-Type is the blob's type.
export const uploadAvatar = (blob) =>
  api.put('/account/avatar', blob, { headers: { 'Content-Type': blob.type } }).then((res) => res.data.avatarUrl);
export const removeAvatar = () => api.delete('/account/avatar');
