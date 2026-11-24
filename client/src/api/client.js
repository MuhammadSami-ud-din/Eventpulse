import axios from 'axios';

// The server names the cookie "__Host-csrf_token" in production (HTTPS only)
// and "csrf_token" in development, so both are checked.
const CSRF_COOKIE_NAMES = ['__Host-csrf_token', 'csrf_token'];
const SAFE_METHODS = new Set(['get', 'head', 'options']);
// These handle their own 401s; retrying them after a refresh makes no sense.
const NO_REFRESH_PATHS = ['/auth/login', '/auth/register', '/auth/refresh', '/auth/logout'];

export const api = axios.create({ baseURL: '/api', withCredentials: true, timeout: 15000 });

function readCookie(name) {
  const prefix = `${name}=`;
  const match = document.cookie.split('; ').find((cookie) => cookie.startsWith(prefix));
  return match ? decodeURIComponent(match.slice(prefix.length)) : null;
}

function csrfToken() {
  return CSRF_COOKIE_NAMES.map(readCookie).find(Boolean) ?? null;
}

api.interceptors.request.use((config) => {
  if (!SAFE_METHODS.has(config.method)) {
    const token = csrfToken();
    if (token) config.headers['X-CSRF-Token'] = token;
  }
  return config;
});

let onSessionExpired = () => {};
export function setSessionExpiredHandler(handler) {
  onSessionExpired = handler;
}

// Several requests can fail with 401 at the same moment (e.g. a page loading
// three things after the access token expired). They all wait for one refresh
// instead of each sending its own, which would trip refresh-token reuse detection.
let refreshInFlight = null;
function refreshSession() {
  refreshInFlight ??= api.post('/auth/refresh').finally(() => {
    refreshInFlight = null;
  });
  return refreshInFlight;
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const { config, response } = error;
    if (!config || !response || config.retried) throw error;
    const code = response.data?.error?.code;

    if (response.status === 403 && code === 'CSRF_INVALID') {
      config.retried = true;
      await api.get('/auth/csrf');
      return api(config);
    }

    if (response.status === 401 && !NO_REFRESH_PATHS.some((path) => config.url.startsWith(path))) {
      config.retried = true;
      try {
        await refreshSession();
      } catch {
        onSessionExpired();
        throw error;
      }
      return api(config);
    }

    throw error;
  },
);
