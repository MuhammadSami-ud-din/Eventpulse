import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import jwt from 'jsonwebtoken';
import { env } from '../src/config/env.js';
import { pool } from '../src/db/pool.js';
import { CSRF_HEADER } from '../src/middleware/csrf.js';
import { ACCESS_COOKIE, CSRF_COOKIE, REFRESH_COOKIE } from '../src/utils/authCookies.js';
import { TestContext } from './helpers.js';

const ctx = new TestContext();
before(() => ctx.start());
after(() => ctx.cleanup());

const PASSWORD = 'Campus@2026';
let signUps = 0;

function newStudent(overrides = {}) {
  signUps += 1;
  return {
    fullName: 'New Student',
    email: `signup-${ctx.runId}-${signUps}@eventhub.test`,
    studentNumber: `S${ctx.runId}${signUps}`.slice(0, 20),
    password: PASSWORD,
    ...overrides,
  };
}

async function signUp(fields) {
  const session = await ctx.newSession();
  const res = await session.call('POST', '/auth/register', fields);
  if (res.status === 201) ctx.userIds.push(res.body.user.id);
  return { session, res };
}

// The Set-Cookie header for one cookie, e.g. "access_token=…; Path=/api; HttpOnly; SameSite=Strict".
const setCookie = (res, name) => res.headers.getSetCookie().find((header) => header.startsWith(`${name}=`));

describe('signing up', () => {
  test('creates a logged-in student; cookies are httpOnly and SameSite=Strict; no password comes back', async () => {
    const fields = newStudent({ email: `MiXeD-${ctx.runId}@EventHub.test` });
    const { session, res } = await signUp(fields);

    assert.equal(res.status, 201);
    assert.equal(res.body.user.role, 'student');
    assert.equal(res.body.user.email, fields.email.toLowerCase());
    assert.ok(!JSON.stringify(res.body).toLowerCase().includes('password'));

    const access = setCookie(res, ACCESS_COOKIE);
    const refresh = setCookie(res, REFRESH_COOKIE);
    for (const cookie of [access, refresh]) {
      assert.match(cookie, /HttpOnly/);
      assert.match(cookie, /SameSite=Strict/);
    }
    assert.match(access, /Path=\/api;/);
    assert.match(refresh, /Path=\/api\/auth;/, 'the refresh token only travels to the auth routes');
    assert.equal((await session.call('GET', '/auth/me')).body.user.email, fields.email.toLowerCase());
  });

  test('anyone signing up is a student, whatever role they ask for', async () => {
    const { res } = await signUp({ ...newStudent(), role: 'admin' });
    assert.equal(res.body.user.role, 'student');
  });

  test('an email (in any case) or student number can only be used once', async () => {
    const first = newStudent();
    await signUp(first);

    const sameEmail = await signUp(newStudent({ email: first.email.toUpperCase() }));
    assert.equal(sameEmail.res.status, 409);
    assert.equal(sameEmail.res.body.error.code, 'EMAIL_TAKEN');

    const sameNumber = await signUp(newStudent({ studentNumber: first.studentNumber }));
    assert.equal(sameNumber.res.status, 409);
    assert.equal(sameNumber.res.body.error.code, 'STUDENT_NUMBER_TAKEN');
  });
});

describe('logging in', () => {
  test('a wrong password and an unknown email get the exact same answer', async () => {
    const user = await ctx.createUser('student', { password: PASSWORD });
    const session = await ctx.newSession();

    const wrongPassword = await session.call('POST', '/auth/login', { email: user.email, password: 'Wrong@2026' });
    const unknownEmail = await session.call('POST', '/auth/login', {
      email: `nobody-${ctx.runId}@eventhub.test`,
      password: PASSWORD,
    });

    assert.equal(wrongPassword.status, 401);
    assert.deepEqual(wrongPassword.body, unknownEmail.body, 'nothing reveals which emails have accounts');
  });

  test('after 5 failures for one email, that email is blocked (429); other emails are not', async () => {
    const target = await ctx.createUser('student', { password: PASSWORD });
    const bystander = await ctx.createUser('student', { password: PASSWORD });
    const session = await ctx.newSession();

    for (let attempt = 1; attempt <= 5; attempt += 1) {
      const res = await session.call('POST', '/auth/login', { email: target.email, password: 'Guess@0000' });
      assert.equal(res.status, 401, `attempt ${attempt}`);
    }
    const blocked = await session.call('POST', '/auth/login', { email: target.email, password: PASSWORD });
    assert.equal(blocked.status, 429, 'even the right password waits out the block');
    assert.equal((await ctx.login(bystander.email, PASSWORD)).loginStatus, 200);
  });
});

describe('sessions', () => {
  // Signs an access token the way the server does, with chosen secret and lifetime.
  function accessToken(userId, { secret = env.JWT_ACCESS_SECRET, expiresIn = 60 } = {}) {
    return jwt.sign({}, secret, {
      algorithm: 'HS256',
      issuer: 'eventhub',
      audience: 'eventhub-api',
      subject: String(userId),
      expiresIn,
    });
  }

  const meWith = (token) => fetch(`${ctx.baseUrl}/auth/me`, { headers: { cookie: `${ACCESS_COOKIE}=${token}` } });

  test('/auth/me needs a valid, unexpired access token', async () => {
    const user = await ctx.createUser('student');

    assert.equal((await fetch(`${ctx.baseUrl}/auth/me`)).status, 401, 'no token');
    assert.equal((await meWith(accessToken(user.id))).status, 200);

    const forged = await meWith(accessToken(user.id, { secret: 'not-the-real-secret-0123456789abcdef' }));
    assert.equal((await forged.json()).error.code, 'INVALID_TOKEN');
    const expired = await meWith(accessToken(user.id, { expiresIn: -60 }));
    assert.equal((await expired.json()).error.code, 'TOKEN_EXPIRED');
    const unsigned = await meWith(jwt.sign({ sub: String(user.id) }, null, { algorithm: 'none' }));
    assert.equal(unsigned.status, 401, 'an unsigned ("alg: none") token is refused');
  });

  test('refreshing rotates the token: the new one works, the old one does not', async () => {
    const user = await ctx.createUser('student', { password: PASSWORD });
    const session = await ctx.login(user.email, PASSWORD);
    const oldToken = session.cookies.get(REFRESH_COOKIE);

    const res = await session.call('POST', '/auth/refresh');
    assert.equal(res.status, 200);
    const newToken = session.cookies.get(REFRESH_COOKIE);
    assert.notEqual(newToken, oldToken);

    // Replayed within the 10-second grace window: refused, but treated as a
    // race between two tabs, so the real session survives.
    session.cookies.set(REFRESH_COOKIE, oldToken);
    assert.equal((await session.call('POST', '/auth/refresh')).status, 401);
    session.cookies.set(REFRESH_COOKIE, newToken);
    assert.equal((await session.call('POST', '/auth/refresh')).status, 200);
  });

  test('an old token replayed after the grace window logs out every session (theft detection)', async () => {
    const user = await ctx.createUser('student', { password: PASSWORD });
    const laptop = await ctx.login(user.email, PASSWORD);
    const phone = await ctx.login(user.email, PASSWORD);
    const stolen = laptop.cookies.get(REFRESH_COOKIE);
    await laptop.call('POST', '/auth/refresh');
    // Pretend the rotation happened a minute ago instead of waiting 10 seconds.
    await pool.query(
      'UPDATE refresh_tokens SET revoked_at = revoked_at - INTERVAL 1 MINUTE WHERE user_id = ? AND revoked_at IS NOT NULL',
      [user.id],
    );

    const attacker = await ctx.newSession();
    attacker.cookies.set(REFRESH_COOKIE, stolen);
    assert.equal((await attacker.call('POST', '/auth/refresh')).status, 401);

    assert.equal((await laptop.call('POST', '/auth/refresh')).status, 401, 'the real laptop is logged out too');
    assert.equal((await phone.call('POST', '/auth/refresh')).status, 401, 'and every other device');
    assert.equal((await ctx.login(user.email, PASSWORD)).loginStatus, 200, 'the password still works');
  });

  test('logging out revokes the refresh token, clears the cookies and renews the CSRF token', async () => {
    const user = await ctx.createUser('student', { password: PASSWORD });
    const session = await ctx.login(user.email, PASSWORD);
    const refreshToken = session.cookies.get(REFRESH_COOKIE);
    const csrfBefore = session.cookies.get(CSRF_COOKIE);

    const res = await session.call('POST', '/auth/logout');

    assert.equal(res.status, 204);
    assert.ok(!session.cookies.has(ACCESS_COOKIE) && !session.cookies.has(REFRESH_COOKIE));
    assert.notEqual(session.cookies.get(CSRF_COOKIE), csrfBefore);
    session.cookies.set(REFRESH_COOKIE, refreshToken);
    assert.equal((await session.call('POST', '/auth/refresh')).status, 401, 'a copy of the token is useless');
  });
});

describe('CSRF protection', () => {
  test('a request that changes something needs the CSRF header to match the cookie', async () => {
    const user = await ctx.createUser('student', { password: PASSWORD });
    const session = await ctx.login(user.email, PASSWORD);
    const cookie = [...session.cookies].map(([name, value]) => `${name}=${value}`).join('; ');
    const logout = (headers) => fetch(`${ctx.baseUrl}/auth/logout`, { method: 'POST', headers: { cookie, ...headers } });

    let res = await logout({});
    assert.equal(res.status, 403, 'no header: a cross-site form post looks like this');
    assert.equal((await res.json()).error.code, 'CSRF_INVALID');
    res = await logout({ [CSRF_HEADER]: 'x'.repeat(43) });
    assert.equal(res.status, 403, 'a guessed header');
    assert.equal((await session.call('GET', '/auth/me')).status, 200, 'reading needs no token, and the session survived');
  });

  test('GET /auth/csrf keeps a valid token and replaces a malformed one', async () => {
    const session = await ctx.newSession();
    const token = session.cookies.get(CSRF_COOKIE);
    await session.call('GET', '/auth/csrf');
    assert.equal(session.cookies.get(CSRF_COOKIE), token, 'other tabs keep working');

    session.cookies.set(CSRF_COOKIE, 'tampered');
    const res = await session.call('GET', '/auth/csrf');
    assert.match(res.body.csrfToken, /^[A-Za-z0-9_-]{43}$/);
    assert.equal(session.cookies.get(CSRF_COOKIE), res.body.csrfToken);
  });
});
