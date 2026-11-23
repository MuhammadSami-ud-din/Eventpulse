import { fileURLToPath } from 'node:url';
import { z } from 'zod';

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

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  CLIENT_ORIGIN: z.url().default('http://localhost:5173'),
  TRUST_PROXY: z.coerce.number().int().min(0).default(0),
  DB_HOST: z.string().min(1).default('127.0.0.1'),
  DB_PORT: z.coerce.number().int().positive().default(3306),
  DB_USER: z.string().min(1),
  DB_PASSWORD: z.string().default(''),
  // Restricted because the name is interpolated into CREATE/DROP DATABASE.
  DB_NAME: z.string().regex(/^[A-Za-z0-9_]+$/, 'must contain only letters, digits and underscores'),
  DB_CONNECTION_LIMIT: z.coerce.number().int().min(1).max(100).default(10),
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  ACCESS_TOKEN_TTL_MINUTES: z.coerce.number().int().min(1).max(60).default(15),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().min(1).max(30).default(7),
  BCRYPT_ROUNDS: z.coerce.number().int().min(10).max(15).default(12),
}).refine((env) => env.JWT_ACCESS_SECRET !== env.JWT_REFRESH_SECRET, {
  message: 'must differ from JWT_ACCESS_SECRET',
  path: ['JWT_REFRESH_SECRET'],
});

function parseEnv() {
  loadEnvFile(ENV_FILE);
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    console.error(`Invalid environment configuration:\n${z.prettifyError(result.error)}`);
    process.exit(1);
  }
  return Object.freeze(result.data);
}

export const env = parseEnv();
export const isProduction = env.NODE_ENV === 'production';
