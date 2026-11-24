import assert from 'node:assert/strict';
import { once } from 'node:events';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { after, before, describe, test } from 'node:test';
import { createApp } from '../src/app.js';
import { pool } from '../src/db/pool.js';

// A stand-in for client/dist, so these tests do not depend on a real build.
let distDir;
let server;
let baseUrl;

before(async () => {
  distDir = await mkdtemp(path.join(tmpdir(), 'eventhub-dist-'));
  await mkdir(path.join(distDir, 'assets'));
  await writeFile(path.join(distDir, 'index.html'), '<!doctype html><div id="root"></div>');
  await writeFile(path.join(distDir, 'assets', 'index-abc123.js'), 'console.log("app")');
  await writeFile(path.join(distDir, 'favicon.svg'), '<svg xmlns="http://www.w3.org/2000/svg"/>');

  server = createApp({ clientDistDir: distDir }).listen(0, '127.0.0.1');
  await once(server, 'listening');
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  server.close();
  server.closeAllConnections();
  await rm(distDir, { recursive: true, force: true });
  await pool.end();
});

describe('serving the built client in production', () => {
  test('client routes get index.html, revalidated on every visit', async () => {
    for (const route of ['/', '/events/3', '/organizer/events/12/check-in', '/t/ABCDEFGH23']) {
      const res = await fetch(`${baseUrl}${route}`);
      assert.equal(res.status, 200, route);
      assert.match(res.headers.get('content-type'), /text\/html/);
      assert.equal(res.headers.get('cache-control'), 'no-cache', route);
      assert.match(await res.text(), /<div id="root">/);
    }
  });

  test('hashed assets are cached forever; other files are revalidated', async () => {
    const asset = await fetch(`${baseUrl}/assets/index-abc123.js`);
    assert.equal(asset.status, 200);
    assert.equal(asset.headers.get('cache-control'), 'public, max-age=31536000, immutable');
    const favicon = await fetch(`${baseUrl}/favicon.svg`);
    assert.equal(favicon.headers.get('cache-control'), 'no-cache');
  });

  test('a missing file is a real 404, not index.html', async () => {
    const res = await fetch(`${baseUrl}/assets/index-old999.js`);
    assert.equal(res.status, 404);
    assert.match(res.headers.get('content-type'), /application\/json/);
  });

  test('the API still answers with JSON, including its 404s', async () => {
    const health = await fetch(`${baseUrl}/api/health`);
    assert.deepEqual(await health.json(), { status: 'ok', database: 'up' });
    const missing = await fetch(`${baseUrl}/api/does-not-exist`);
    assert.equal(missing.status, 404);
    assert.equal((await missing.json()).error.code, 'NOT_FOUND');
  });

  test('pages get a Content-Security-Policy that allows blob: images (the QR ticket)', async () => {
    const csp = (await fetch(`${baseUrl}/`)).headers.get('content-security-policy');
    assert.match(csp, /img-src 'self' data: blob:/);
    assert.match(csp, /script-src 'self'/);
  });
});
