import { once } from 'node:events';
import { randomBytes, randomUUID } from 'node:crypto';
import bcrypt from 'bcrypt';
import { createApp } from '../src/app.js';
import { env, isProduction } from '../src/config/env.js';
import { pool } from '../src/db/pool.js';
import { CSRF_HEADER } from '../src/middleware/csrf.js';
import { signAccessToken } from '../src/services/token.service.js';
import { ACCESS_COOKIE, CSRF_COOKIE } from '../src/utils/authCookies.js';

if (isProduction) throw new Error('Refusing to run tests against a production database.');

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

export const fromNow = (ms) => new Date(Date.now() + ms);
export const hours = (n) => n * HOUR_MS;
export const days = (n) => n * DAY_MS;

async function send(baseUrl, method, path, { body, cookie, csrfToken }) {
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      ...(cookie && { cookie }),
      ...(csrfToken && { [CSRF_HEADER]: csrfToken }),
      ...(body && { 'content-type': 'application/json' }),
    },
    body: body && JSON.stringify(body),
  });
  const isJson = res.headers.get('content-type')?.includes('application/json');
  return {
    status: res.status,
    headers: res.headers,
    body: isJson ? await res.json() : Buffer.from(await res.arrayBuffer()),
  };
}

// Authenticates as a user without a password: a signed access token plus a
// matching CSRF cookie/header pair, exactly what a logged-in browser sends.
// `call.raw` sends the body exactly as given (malformed JSON, other content types).
function apiClient(baseUrl, userId) {
  const csrfToken = randomBytes(32).toString('base64url');
  const cookie = `${ACCESS_COOKIE}=${signAccessToken(userId)}; ${CSRF_COOKIE}=${csrfToken}`;
  const call = (method, path, body) => send(baseUrl, method, path, { body, cookie, csrfToken });
  call.raw = async (method, path, rawBody, contentType = 'application/json') => {
    const res = await fetch(`${baseUrl}${path}`, {
      method,
      headers: { cookie, [CSRF_HEADER]: csrfToken, 'content-type': contentType },
      // fetch refuses a body on GET/HEAD, so those are sent without one.
      body: ['GET', 'HEAD'].includes(method) ? undefined : rawBody,
    });
    const isJson = res.headers.get('content-type')?.includes('application/json');
    return { status: res.status, body: isJson ? await res.json() : await res.text() };
  };
  return call;
}

// Behaves like a browser: keeps the cookies the server sets, sends them back,
// and echoes the CSRF cookie in the header. Used to test real login flows.
// (Cookie paths are ignored, so every cookie goes with every request.)
function browserSession(baseUrl) {
  const cookies = new Map();

  async function call(method, path, body) {
    const cookie = [...cookies].map(([name, value]) => `${name}=${value}`).join('; ');
    const res = await send(baseUrl, method, path, { body, cookie, csrfToken: cookies.get(CSRF_COOKIE) });
    for (const setCookie of res.headers.getSetCookie()) {
      const [pair] = setCookie.split(';');
      const name = pair.slice(0, pair.indexOf('='));
      const value = pair.slice(pair.indexOf('=') + 1);
      if (value) cookies.set(name, value);
      else cookies.delete(name);
    }
    return res;
  }
  return { call, cookies };
}

// Owns everything one test file creates, and deletes all of it in cleanup().
// Rows are tagged with a per-run id so leftovers from a crashed run never
// collide with a new one and are easy to spot.
export class TestContext {
  runId = `${Date.now().toString(36)}${randomBytes(2).toString('hex')}`;
  userIds = [];
  eventIds = [];
  // categoryIds[0] is the default category for createEvent(); tests add the ones they create.
  categoryIds = [];
  organizer = null;
  // Incremented synchronously, so users created in parallel never share a number.
  #userCount = 0;

  async start() {
    this.server = createApp().listen(0, '127.0.0.1');
    await once(this.server, 'listening');
    this.baseUrl = `http://127.0.0.1:${this.server.address().port}/api`;

    // Real but unguessable password, so nobody can log in as a test user.
    this.passwordHash = await bcrypt.hash(randomUUID(), 4);
    const [category] = await pool.query(
      'INSERT INTO event_categories (name, slug) VALUES (?, ?)',
      [`Test ${this.runId}`, `test-${this.runId}`],
    );
    this.categoryIds.push(category.insertId);
    this.organizer = await this.createUser('organizer');
  }

  // Pass a password to be able to log in as this user through the real API.
  async createUser(role, { password, fullName } = {}) {
    this.#userCount += 1;
    const n = this.#userCount;
    const email = `test-${this.runId}-${n}@eventhub.test`;
    const [result] = await pool.query(
      `INSERT INTO users (full_name, email, password_hash, role, student_number)
       VALUES (?, ?, ?, ?, ?)`,
      [
        fullName ?? `Test ${role} ${n}`,
        email,
        password ? await bcrypt.hash(password, 4) : this.passwordHash,
        role,
        role === 'student' ? `T${this.runId}${n}`.slice(0, 20) : null,
      ],
    );
    this.userIds.push(result.insertId);
    return { id: result.insertId, email, call: apiClient(this.baseUrl, result.insertId) };
  }

  async login(email, password) {
    const session = browserSession(this.baseUrl);
    await session.call('GET', '/auth/csrf');
    const res = await session.call('POST', '/auth/login', { email, password });
    return { ...session, loginStatus: res.status };
  }

  createStudents(count) {
    return Promise.all(Array.from({ length: count }, () => this.createUser('student')));
  }

  // Inserted directly as published: approval is not what these tests are about.
  async createEvent({
    capacity = 10,
    startsAt = fromNow(days(5)),
    registrationDeadline = new Date(startsAt.getTime() - hours(2)),
    cancellationWindowHours = 24,
    categoryId = this.categoryIds[0],
    organizerId = this.organizer.id,
  } = {}) {
    const [result] = await pool.query(
      `INSERT INTO events (
         organizer_id, category_id, title, description, venue, starts_at, ends_at,
         registration_deadline, cancellation_window_hours, capacity, status
       ) VALUES (?, ?, ?, 'Created by the automated test suite.', 'Test Lab', ?, ?, ?, ?, ?, 'published')`,
      [
        organizerId,
        categoryId,
        `Test event ${this.runId}`,
        startsAt,
        new Date(startsAt.getTime() + hours(2)),
        registrationDeadline,
        cancellationWindowHours,
        capacity,
      ],
    );
    this.eventIds.push(result.insertId);
    return result.insertId;
  }

  // Call right before firing parallel requests. The pool opens connections
  // lazily, so on a cold pool the first request commits while the others are
  // still waiting for a connection, and a missing lock goes unnoticed. With
  // every connection already open, the requests really do overlap.
  async warmUpDatabasePool() {
    await Promise.all(
      Array.from({ length: env.DB_CONNECTION_LIMIT }, () => fetch(`${this.baseUrl}/health`)),
    );
  }

  // Moves an event in time (e.g. into the past) after students registered,
  // since registration itself is only possible before the event starts.
  async setEventTimes(eventId, { startsAt, endsAt, registrationDeadline = startsAt }) {
    await pool.query(
      'UPDATE events SET starts_at = ?, ends_at = ?, registration_deadline = ? WHERE id = ?',
      [startsAt, endsAt, registrationDeadline, eventId],
    );
  }

  // Children before parents so foreign keys are satisfied. Runs even when
  // tests fail, then closes the server and pool so the process can exit.
  async cleanup() {
    try {
      if (this.eventIds.length) {
        const events = [this.eventIds];
        await pool.query('DELETE FROM notifications WHERE event_id IN (?)', events);
        await pool.query(
          `DELETE a FROM event_attendance a
           JOIN event_registrations r ON r.id = a.registration_id
           WHERE r.event_id IN (?)`,
          events,
        );
        await pool.query('DELETE FROM event_registrations WHERE event_id IN (?)', events);
        await pool.query('DELETE FROM events WHERE id IN (?)', events);
      }
      if (this.userIds.length) {
        // notifications and refresh_tokens are removed by ON DELETE CASCADE.
        await pool.query('DELETE FROM users WHERE id IN (?)', [this.userIds]);
      }
      if (this.categoryIds.length) {
        await pool.query('DELETE FROM event_categories WHERE id IN (?)', [this.categoryIds]);
      }
    } finally {
      this.server?.close();
      // fetch keeps sockets alive; without this, close() waits for them forever.
      this.server?.closeAllConnections();
      await pool.end();
    }
  }
}
