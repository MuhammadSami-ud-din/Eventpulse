import { randomBytes, timingSafeEqual } from 'node:crypto';
import { CSRF_COOKIE } from '../utils/authCookies.js';
import { HttpError } from '../utils/HttpError.js';

// Double-submit cookie: the server sets a random token in a cookie, and the
// client must echo it in the X-CSRF-Token header. Another site can make the
// browser send our cookies, but it cannot read them to fill in the header.
export const CSRF_HEADER = 'x-csrf-token';
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export function generateCsrfToken() {
  return randomBytes(32).toString('base64url');
}

export function isWellFormedCsrfToken(token) {
  return typeof token === 'string' && TOKEN_PATTERN.test(token);
}

function tokensMatch(a, b) {
  const bufferA = Buffer.from(a);
  const bufferB = Buffer.from(b);
  return bufferA.length === bufferB.length && timingSafeEqual(bufferA, bufferB);
}

export function csrfProtection(req, res, next) {
  if (SAFE_METHODS.has(req.method)) return next();

  const cookieToken = req.cookies[CSRF_COOKIE];
  const headerToken = req.get(CSRF_HEADER);
  if (!isWellFormedCsrfToken(cookieToken) || !headerToken || !tokensMatch(cookieToken, headerToken)) {
    return next(new HttpError(403, 'CSRF_INVALID', 'Missing or invalid CSRF token, refresh the page and try again'));
  }
  next();
}
