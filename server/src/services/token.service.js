import { randomUUID } from 'node:crypto';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { HttpError } from '../utils/HttpError.js';

const ISSUER = 'eventhub';
const AUDIENCE = 'eventhub-api';
// Pinning the algorithm stops a forged token from choosing a weaker one (e.g. "none").
const ALGORITHM = 'HS256';

const signOptions = { algorithm: ALGORITHM, issuer: ISSUER, audience: AUDIENCE };
const verifyOptions = { algorithms: [ALGORITHM], issuer: ISSUER, audience: AUDIENCE };

export const refreshTokenTtlMs = env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000;

export function signAccessToken(userId) {
  return jwt.sign({}, env.JWT_ACCESS_SECRET, {
    ...signOptions,
    subject: String(userId),
    expiresIn: env.ACCESS_TOKEN_TTL_MINUTES * 60,
  });
}

export function signRefreshToken(userId) {
  const jti = randomUUID();
  const token = jwt.sign({}, env.JWT_REFRESH_SECRET, {
    ...signOptions,
    subject: String(userId),
    jwtid: jti,
    expiresIn: refreshTokenTtlMs / 1000,
  });
  return { token, jti };
}

function verify(token, secret) {
  try {
    return jwt.verify(token, secret, verifyOptions);
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      throw new HttpError(401, 'TOKEN_EXPIRED', 'Your session has expired');
    }
    throw new HttpError(401, 'INVALID_TOKEN', 'Your session is invalid, please log in again');
  }
}

export function verifyAccessToken(token) {
  return { userId: Number(verify(token, env.JWT_ACCESS_SECRET).sub) };
}

export function verifyRefreshToken(token) {
  const claims = verify(token, env.JWT_REFRESH_SECRET);
  return { userId: Number(claims.sub), jti: claims.jti };
}
