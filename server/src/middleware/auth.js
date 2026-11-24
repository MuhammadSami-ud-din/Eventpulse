import { pool } from '../db/pool.js';
import { verifyAccessToken } from '../services/token.service.js';
import { findActiveUserById } from '../services/user.service.js';
import { ACCESS_COOKIE } from '../utils/authCookies.js';
import { HttpError } from '../utils/HttpError.js';

// The user is re-read on every request (a primary-key lookup) so that a
// deactivated account or a changed role takes effect immediately instead of
// when the 15-minute access token expires. Role always comes from the DB.
export async function authenticate(req, res, next) {
  const token = req.cookies[ACCESS_COOKIE];
  if (!token) throw new HttpError(401, 'AUTH_REQUIRED', 'Please log in to continue');

  const { userId } = verifyAccessToken(token);
  const user = await findActiveUserById(pool, userId);
  if (!user) throw new HttpError(401, 'AUTH_REQUIRED', 'Please log in to continue');

  req.user = user;
  next();
}

// Must run after authenticate.
export function requireRole(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return next(new HttpError(403, 'FORBIDDEN', 'You do not have permission to do this'));
    }
    next();
  };
}

// For pages anyone may load but signed-in users may see more of (e.g. a
// student's avatar). A missing, expired or invalid token simply means anonymous.
export async function optionalAuthenticate(req, res, next) {
  const token = req.cookies[ACCESS_COOKIE];
  if (token) {
    try {
      const { userId } = verifyAccessToken(token);
      req.user = (await findActiveUserById(pool, userId)) ?? undefined;
    } catch {
      req.user = undefined;
    }
  }
  next();
}
