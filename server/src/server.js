import { createApp } from './app.js';
import { env } from './config/env.js';
import { pool } from './db/pool.js';

const server = createApp().listen(env.PORT, () => {
  console.log(`EventHub API listening on http://localhost:${env.PORT}`);
});

function shutdown(signal) {
  console.log(`${signal} received, shutting down`);
  server.close(() => pool.end().finally(() => process.exit(0)));
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
