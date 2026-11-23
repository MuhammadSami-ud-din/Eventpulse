import { ipKeyGenerator, rateLimit } from 'express-rate-limit';
import { HttpError } from '../utils/HttpError.js';

const FIFTEEN_MINUTES = 15 * 60 * 1000;
const ONE_HOUR = 60 * 60 * 1000;

function rejectWithJson(req, res, next) {
  next(new HttpError(429, 'RATE_LIMITED', 'Too many attempts, please wait a few minutes and try again'));
}

const sharedOptions = { standardHeaders: 'draft-8', legacyHeaders: false, handler: rejectWithJson };

// Limits are generous per IP because a whole campus Wi-Fi network can share one
// public IP; the strict brute-force limit is per IP *and* email instead.
export const authLimiter = rateLimit({ ...sharedOptions, windowMs: FIFTEEN_MINUTES, limit: 300 });

export const loginLimiter = rateLimit({
  ...sharedOptions,
  windowMs: FIFTEEN_MINUTES,
  limit: 5,
  skipSuccessfulRequests: true,
  // Runs after validation, so the email is already normalised.
  keyGenerator: (req) => `${ipKeyGenerator(req.ip)}:${req.validated.body.email}`,
});

export const registerLimiter = rateLimit({ ...sharedOptions, windowMs: ONE_HOUR, limit: 20 });
