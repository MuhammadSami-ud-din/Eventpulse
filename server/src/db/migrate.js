import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mysql from 'mysql2/promise';
import { env, isProduction } from '../config/env.js';
import { connectionOptions, UTC_SESSION_SQL } from './connectionOptions.js';

const MIGRATIONS_DIR = fileURLToPath(new URL('./migrations/', import.meta.url));
const databaseId = mysql.escapeId(env.DB_NAME);

async function listMigrationFiles() {
  const files = await readdir(MIGRATIONS_DIR);
  return files.filter((file) => file.endsWith('.sql')).sort();
}

async function ensureMigrationsTable(connection) {
  await connection.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name VARCHAR(255) PRIMARY KEY,
      applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB`);
}

async function getAppliedMigrations(connection) {
  const [rows] = await connection.query('SELECT name FROM schema_migrations');
  return new Set(rows.map((row) => row.name));
}

// MySQL auto-commits DDL, so a migration cannot be rolled back as a unit.
// Keeping one table per file limits the damage of a failed migration.
async function applyMigration(connection, file) {
  const sql = await readFile(path.join(MIGRATIONS_DIR, file), 'utf8');
  await connection.query(sql);
  await connection.query('INSERT INTO schema_migrations (name) VALUES (?)', [file]);
  console.log(`  applied ${file}`);
}

async function prepareDatabase(connection, { fresh }) {
  if (fresh) {
    if (isProduction) throw new Error('Refusing to drop the database in production.');
    await connection.query(`DROP DATABASE IF EXISTS ${databaseId}`);
    console.log(`Dropped database ${env.DB_NAME}`);
  }
  await connection.query(
    `CREATE DATABASE IF NOT EXISTS ${databaseId} CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci`,
  );
  await connection.query(`USE ${databaseId}`);
  await connection.query(UTC_SESSION_SQL);
}

async function migrate({ fresh }) {
  const connection = await mysql.createConnection({ ...connectionOptions, multipleStatements: true });
  try {
    await prepareDatabase(connection, { fresh });
    await ensureMigrationsTable(connection);

    const applied = await getAppliedMigrations(connection);
    const pending = (await listMigrationFiles()).filter((file) => !applied.has(file));

    if (pending.length === 0) {
      console.log('Database is up to date.');
      return;
    }
    console.log(`Running ${pending.length} migration(s) on ${env.DB_NAME}:`);
    for (const file of pending) {
      await applyMigration(connection, file);
    }
  } finally {
    await connection.end();
  }
}

migrate({ fresh: process.argv.includes('--fresh') }).catch((err) => {
  console.error(`Migration failed: ${err.message}`);
  process.exitCode = 1;
});
