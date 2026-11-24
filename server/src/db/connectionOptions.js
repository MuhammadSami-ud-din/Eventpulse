import { env } from '../config/env.js';

// Shared by the app pool and the migration script (which connects before the
// database exists, so DB_NAME is added separately by each caller).
export const connectionOptions = {
  host: env.DB_HOST,
  port: env.DB_PORT,
  user: env.DB_USER,
  password: env.DB_PASSWORD,
  charset: 'utf8mb4',
  // All DATETIME columns hold UTC; this makes mysql2 convert JS Dates as UTC.
  timezone: 'Z',
  ssl: env.DB_SSL ? { rejectUnauthorized: true, ...(env.DB_SSL_CA && { ca: env.DB_SSL_CA }) } : undefined,
};

export const UTC_SESSION_SQL = "SET time_zone = '+00:00'";
