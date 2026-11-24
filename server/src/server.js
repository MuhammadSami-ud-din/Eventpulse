import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createApp } from './app.js';
import { env, isProduction } from './config/env.js';
import { pool } from './db/pool.js';

const CLIENT_DIST_DIR = fileURLToPath(new URL('../../client/dist', import.meta.url));

// In production one service serves both the API and the built client.
function clientDistDir() {
  if (!isProduction) return undefined;
  if (!existsSync(CLIENT_DIST_DIR)) {
    console.error(`Built client not found at ${CLIENT_DIST_DIR}. Run "npm run build" first.`);
    process.exit(1);
  }
  return CLIENT_DIST_DIR;
}

const server = createApp({ clientDistDir: clientDistDir() }).listen(env.PORT, () => {
  console.log(`EventHub listening on port ${env.PORT}${isProduction ? ' (serving the built client)' : ''}`);
});

function shutdown(signal) {
  console.log(`${signal} received, shutting down`);
  server.close(() => pool.end().finally(() => process.exit(0)));
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
