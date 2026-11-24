import { api } from './client.js';

export const ensureCsrfToken = () => api.get('/auth/csrf');
export const fetchCurrentUser = () => api.get('/auth/me').then((res) => res.data.user);
export const login = (credentials) => api.post('/auth/login', credentials).then((res) => res.data.user);
export const register = (details) => api.post('/auth/register', details).then((res) => res.data.user);
export const logout = () => api.post('/auth/logout');
export const updateProfile = (profile) => api.patch('/auth/me', profile).then((res) => res.data.user);
export const changePassword = (passwords) => api.post('/auth/password', passwords).then((res) => res.data.user);
