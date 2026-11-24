import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import { parseDatabaseUrl } from './databaseUrl.js';

const ENV_FILE = fileURLToPath(new URL('../../.env', import.meta.url));

// Variables already set in the shell win over the .env file, which lets tests
// point at a separate database (e.g. DB_NAME=eventhub_test npm test).
function loadEnvFile(file) {
  try {
    process.loadEnvFile(file);
  } catch (err) {
    if (err.code !== 'ENOENT') throw err;
  }
}

// Unset and empty both mean "use the default".
const optional = (schema) => z.preprocess((value) => (value === '' ? undefined : value), schema.optional());
const booleanFlag = z.enum(['true', 'false']).default('false').transform((value) => value === 'true');

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  CLIENT_ORIGIN: z.url().default('http://localhost:5173'),
  // Number of proxies in front of the app; see the default in parseEnv().
  TRUST_PROXY: optional(z.coerce.number().int().min(0)),
  // Public base URL of the app (e.g. https://eventhub.example.com). When set,
  // ticket QR codes hold a link to the ticket status page instead of the bare code.
  TICKET_BASE_URL: optional(z.url({ protocol: /^https?$/ })).transform((value) => value?.replace(/\/+$/, '') ?? ''),
  DB_HOST: z.string().min(1).default('127.0.0.1'),
  DB_PORT: z.coerce.number().int().positive().default(3306),
  DB_USER: z.string().min(1),
  DB_PASSWORD: z.string().default(''),
  // Restricted because the name is interpolated into CREATE/DROP DATABASE.
  DB_NAME: z.string().regex(/^[A-Za-z0-9_]+$/, 'must contain only letters, digits and underscores'),
  DB_CONNECTION_LIMIT: z.coerce.number().int().min(1).max(100).default(10),
  // Managed databases often require TLS. DB_SSL_CA is the provider's CA
  // certificate in PEM form (newlines may be written as \n in one line).
  DB_SSL: booleanFlag,
  DB_SSL_CA: optional(z.string()).transform((value) => value?.replace(/\\n/g, '\n')),
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  ACCESS_TOKEN_TTL_MINUTES: z.coerce.number().int().min(1).max(60).default(15),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().min(1).max(30).default(7),
  BCRYPT_ROUNDS: z.coerce.number().int().min(10).max(15).default(12),
}).refine((env) => env.JWT_ACCESS_SECRET !== env.JWT_REFRESH_SECRET, {
  message: 'must differ from JWT_ACCESS_SECRET',
  path: ['JWT_REFRESH_SECRET'],
});

function fail(message) {
  console.error(`Invalid environment configuration:\n${message}`);
  process.exit(1);
}

// DATABASE_URL, when present, replaces the individual DB_* variables.
function readRawEnv() {
  const raw = { ...process.env };
  if (raw.DATABASE_URL) {
    try {
      Object.assign(raw, parseDatabaseUrl(raw.DATABASE_URL));
    } catch (err) {
      fail(err.message);
    }
  }
  return raw;
}

function parseEnv() {
  loadEnvFile(ENV_FILE);
  const result = envSchema.safeParse(readRawEnv());
  if (!result.success) fail(z.prettifyError(result.error));

  const env = result.data;
  // In production the app runs behind the host's HTTPS proxy (1 hop), and the
  // real client IP is in X-Forwarded-For. Locally there is no proxy, and
  // trusting that header would let anyone fake their IP past the rate limits.
  env.TRUST_PROXY ??= env.NODE_ENV === 'production' ? 1 : 0;
  return Object.freeze(env);
}

export const env = parseEnv();
export const isProduction = env.NODE_ENV === 'production';
