import { once } from 'node:events';
import { randomBytes, randomUUID } from 'node:crypto';
import bcrypt from 'bcrypt';
import { createApp } from '../src/app.js';
import { isProduction } from '../src/config/env.js';
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

// Authenticates as a user without a password: a signed access token plus a
// matching CSRF cookie/header pair, exactly what a logged-in browser sends.
function apiClient(baseUrl, userId) {
  const csrfToken = randomBytes(32).toString('base64url');
  const cookie = `${ACCESS_COOKIE}=${signAccessToken(userId)}; ${CSRF_COOKIE}=${csrfToken}`;

  return async function call(method, path, body) {
    const res = await fetch(`${baseUrl}${path}`, {
      method,
      headers: {
        cookie,
        [CSRF_HEADER]: csrfToken,
        ...(body && { 'content-type': 'application/json' }),
      },
      body: body && JSON.stringify(body),
    });
    const text = await res.text();
    return { status: res.status, body: text ? JSON.parse(text) : null };
  };
}

// Owns everything one test file creates, and deletes all of it in cleanup().
// Rows are tagged with a per-run id so leftovers from a crashed run never
// collide with a new one and are easy to spot.
export class TestContext {
  runId = `${Date.now().toString(36)}${randomBytes(2).toString('hex')}`;
  userIds = [];
  eventIds = [];
  categoryId = null;
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
    this.categoryId = category.insertId;
    this.organizer = await this.createUser('organizer');
  }

  async createUser(role) {
    this.#userCount += 1;
    const n = this.#userCount;
    const [result] = await pool.query(
      `INSERT INTO users (full_name, email, password_hash, role, student_number)
       VALUES (?, ?, ?, ?, ?)`,
      [
        `Test ${role} ${n}`,
        `test-${this.runId}-${n}@eventhub.test`,
        this.passwordHash,
        role,
        role === 'student' ? `T${this.runId}${n}`.slice(0, 20) : null,
      ],
    );
    this.userIds.push(result.insertId);
    return { id: result.insertId, call: apiClient(this.baseUrl, result.insertId) };
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
  } = {}) {
    const [result] = await pool.query(
      `INSERT INTO events (
         organizer_id, category_id, title, description, venue, starts_at, ends_at,
         registration_deadline, cancellation_window_hours, capacity, status
       ) VALUES (?, ?, ?, 'Created by the automated test suite.', 'Test Lab', ?, ?, ?, ?, ?, 'published')`,
      [
        this.organizer.id,
        this.categoryId,
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
      if (this.categoryId) {
        await pool.query('DELETE FROM event_categories WHERE id = ?', [this.categoryId]);
      }
    } finally {
      this.server?.close();
      // fetch keeps sockets alive; without this, close() waits for them forever.
      this.server?.closeAllConnections();
      await pool.end();
    }
  }
}
