import * as authService from '../services/auth.service.js';
import { updateProfile as saveProfile } from '../services/user.service.js';
import { clearAuthCookies, CSRF_COOKIE, REFRESH_COOKIE, setAuthCookies, setCsrfCookie } from '../utils/authCookies.js';
import { generateCsrfToken, isWellFormedCsrfToken } from '../middleware/csrf.js';
import { HttpError } from '../utils/HttpError.js';

// Logging in or out changes who the browser is, so the CSRF token is replaced too.
function startSession(res, { user, tokens }) {
  const csrfToken = generateCsrfToken();
  setAuthCookies(res, tokens);
  setCsrfCookie(res, csrfToken);
  return { user, csrfToken };
}

export function getCsrfToken(req, res) {
  const existing = req.cookies[CSRF_COOKIE];
  const csrfToken = isWellFormedCsrfToken(existing) ? existing : generateCsrfToken();
  setCsrfCookie(res, csrfToken);
  res.json({ csrfToken });
}

export async function register(req, res) {
  const session = await authService.registerStudent(req.validated.body);
  res.status(201).json(startSession(res, session));
}

export async function login(req, res) {
  const session = await authService.login(req.validated.body);
  res.json(startSession(res, session));
}

export async function refresh(req, res) {
  const refreshToken = req.cookies[REFRESH_COOKIE];
  if (!refreshToken) throw new HttpError(401, 'AUTH_REQUIRED', 'Please log in to continue');
  try {
    const { user, tokens } = await authService.rotateRefreshToken(refreshToken);
    setAuthCookies(res, tokens);
    res.json({ user });
  } catch (err) {
    // A dead refresh token is useless; clearing it stops the client retrying with it.
    if (err.status === 401) clearAuthCookies(res);
    throw err;
  }
}

export async function logout(req, res) {
  const refreshToken = req.cookies[REFRESH_COOKIE];
  if (refreshToken) await authService.revokeRefreshToken(refreshToken);
  clearAuthCookies(res);
  setCsrfCookie(res, generateCsrfToken());
  res.status(204).end();
}

export function me(req, res) {
  res.json({ user: req.user });
}

export async function updateProfile(req, res) {
  res.json({ user: await saveProfile(req.user.id, req.validated.body) });
}

export async function changePassword(req, res) {
  const { user, tokens } = await authService.changePassword(req.user.id, req.validated.body);
  setAuthCookies(res, tokens);
  res.json({ user });
}
