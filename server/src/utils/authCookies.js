import { env, isProduction } from '../config/env.js';

const MINUTE_MS = 60 * 1000;
const DAY_MS = 24 * 60 * MINUTE_MS;

export const ACCESS_COOKIE = 'access_token';
export const REFRESH_COOKIE = 'refresh_token';
// The __Host- prefix makes browsers reject this cookie unless it is Secure,
// has Path=/ and no Domain, so a sibling subdomain cannot plant a CSRF token.
// The prefix requires HTTPS, so plain http://localhost uses the bare name.
export const CSRF_COOKIE = isProduction ? '__Host-csrf_token' : 'csrf_token';

const baseOptions = { httpOnly: true, secure: isProduction, sameSite: 'strict' };

const accessOptions = { ...baseOptions, path: '/api' };
// Only the auth routes ever need the refresh token, so no other request carries it.
const refreshOptions = { ...baseOptions, path: '/api/auth' };
// Readable by JavaScript on purpose: the client copies it into a request header.
const csrfOptions = { ...baseOptions, httpOnly: false, path: '/' };

export function setAuthCookies(res, { accessToken, refreshToken }) {
  res.cookie(ACCESS_COOKIE, accessToken, { ...accessOptions, maxAge: env.ACCESS_TOKEN_TTL_MINUTES * MINUTE_MS });
  res.cookie(REFRESH_COOKIE, refreshToken, { ...refreshOptions, maxAge: env.REFRESH_TOKEN_TTL_DAYS * DAY_MS });
}

export function setCsrfCookie(res, token) {
  res.cookie(CSRF_COOKIE, token, { ...csrfOptions, maxAge: env.REFRESH_TOKEN_TTL_DAYS * DAY_MS });
}

export function clearAuthCookies(res) {
  res.clearCookie(ACCESS_COOKIE, accessOptions);
  res.clearCookie(REFRESH_COOKIE, refreshOptions);
}
