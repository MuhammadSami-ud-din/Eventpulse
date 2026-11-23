import mysql from 'mysql2/promise';
import { env } from '../config/env.js';
import { connectionOptions, UTC_SESSION_SQL } from './connectionOptions.js';

export const pool = mysql.createPool({
  ...connectionOptions,
  database: env.DB_NAME,
  connectionLimit: env.DB_CONNECTION_LIMIT,
  waitForConnections: true,
});

// Every pooled connection runs in UTC so NOW()/CURRENT_TIMESTAMP match the
// UTC values the app writes. Queries on a connection run in order, so this
// always completes before the first real query.
pool.on('connection', (connection) => {
  connection.query(UTC_SESSION_SQL);
});
