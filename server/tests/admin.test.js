import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { pool } from '../src/db/pool.js';
import { recentMonths } from '../src/services/adminAnalytics.service.js';
import { fromNow, hours, TestContext } from './helpers.js';

const ctx = new TestContext();
let admin;
before(async () => {
  await ctx.start();
  admin = await ctx.createUser('admin');
});
after(() => ctx.cleanup());

const PASSWORD = 'Society@123';

const setRole = (actor, userId, role) => actor.call('PUT', `/admin/users/${userId}/role`, { role });
const setActive = (actor, userId, isActive) => actor.call('PUT', `/admin/users/${userId}/status`, { isActive });

async function register(student, eventId) {
  const { body } = await student.call('POST', `/events/${eventId}/registrations`);
  return body.registration;
}

async function createCategory(name) {
  const res = await admin.call('POST', '/admin/categories', { name, description: 'Made by the test suite' });
  if (res.status === 201) ctx.categoryIds.push(res.body.category.id);
  return res;
}

describe('creating accounts', () => {
  test('an admin creates an organizer account that can log in; no password comes back', async () => {
    const email = `new-organizer-${ctx.runId}@eventhub.test`;

    const res = await admin.call('POST', '/admin/users', {
      fullName: 'Photography Club',
      email: email.toUpperCase(),
      password: PASSWORD,
      department: 'Media',
      role: 'organizer',
    });
    assert.equal(res.status, 201);
    ctx.userIds.push(res.body.user.id);
    assert.equal(res.body.user.email, email, 'emails are stored in lower case');
    assert.equal(res.body.user.role, 'organizer');
    assert.ok(!JSON.stringify(res.body).toLowerCase().includes('password'));
    const session = await ctx.login(email, PASSWORD);
    assert.equal(session.loginStatus, 200);
    assert.equal((await session.call('GET', '/organizer/events')).status, 200);
  });

  test('student accounts, weak passwords and taken emails are refused', async () => {
    const valid = { fullName: 'Someone', email: `x-${ctx.runId}@eventhub.test`, password: PASSWORD, role: 'organizer' };

    let res = await admin.call('POST', '/admin/users', { ...valid, role: 'student' });
    assert.equal(res.status, 400);
    res = await admin.call('POST', '/admin/users', { ...valid, password: 'weak' });
    assert.equal(res.body.error.details[0].field, 'password');
    res = await admin.call('POST', '/admin/users', { ...valid, email: admin.email });
    assert.equal(res.status, 409);
    assert.equal(res.body.error.code, 'EMAIL_TAKEN');
  });

  test('only admins can manage users', async () => {
    const [student] = await ctx.createStudents(1);
    assert.equal((await ctx.organizer.call('GET', '/admin/users')).status, 403);
    assert.equal((await setRole(ctx.organizer, student.id, 'admin')).status, 403);
    assert.equal((await setRole(student, student.id, 'admin')).status, 403);
  });
});

describe('changing roles', () => {
  test('a promoted student can use organizer pages on their very next request', async () => {
    const [student] = await ctx.createStudents(1);
    assert.equal((await student.call('GET', '/organizer/events')).status, 403);

    const res = await setRole(admin, student.id, 'organizer');

    assert.equal(res.status, 200);
    assert.equal(res.body.user.role, 'organizer');
    assert.equal((await student.call('GET', '/organizer/events')).status, 200, 'same session, new role');
  });

  test('a change that would strand registrations, events or the admin themselves is refused', async () => {
    const [registered, futureOrganizer] = await ctx.createStudents(2);
    await register(registered, await ctx.createEvent());
    await setRole(admin, futureOrganizer.id, 'organizer');
    await ctx.createEvent({ organizerId: futureOrganizer.id });

    const cases = [
      [admin.id, 'organizer', 'CANNOT_CHANGE_SELF'],
      [registered.id, 'organizer', 'HAS_ACTIVE_REGISTRATIONS'],
      [ctx.organizer.id, 'student', 'STUDENT_NUMBER_REQUIRED'],
      [futureOrganizer.id, 'student', 'HAS_ACTIVE_EVENTS'],
    ];
    for (const [userId, role, code] of cases) {
      const res = await setRole(admin, userId, role);
      assert.equal(res.status, 409, code);
      assert.equal(res.body.error.code, code);
    }
  });

  test('two admins demoting each other at the same moment: exactly one succeeds', async () => {
    await ctx.warmUpDatabasePool();
    for (let round = 0; round < 5; round += 1) {
      const first = await ctx.createUser('admin');
      const second = await ctx.createUser('admin');

      const results = await Promise.all([
        setRole(first, second.id, 'organizer'),
        setRole(second, first.id, 'organizer'),
      ]);

      assert.deepEqual(results.map((res) => res.status).sort(), [200, 403], `round ${round}`);
      const [rows] = await pool.query("SELECT id FROM users WHERE id IN (?, ?) AND role = 'admin'", [
        first.id,
        second.id,
      ]);
      assert.equal(rows.length, 1, 'one of the two is still an admin');
    }
  });
});

describe('disabling accounts', () => {
  test('logs the user out everywhere, blocks login, and gives upcoming seats to the waitlist', async () => {
    const student = await ctx.createUser('student', { password: PASSWORD });
    const session = await ctx.login(student.email, PASSWORD);
    const [waiting] = await ctx.createStudents(1);
    const upcomingId = await ctx.createEvent({ capacity: 1 });
    const seat = await register(student, upcomingId);
    const waitingReg = await register(waiting, upcomingId);
    // Already under way: this seat is history and stays as it is.
    const startedId = await ctx.createEvent();
    const startedSeat = await register(student, startedId);
    await ctx.setEventTimes(startedId, { startsAt: fromNow(-hours(1)), endsAt: fromNow(hours(1)) });

    const res = await setActive(admin, student.id, false);

    assert.equal(res.status, 200);
    assert.equal(res.body.user.isActive, false);
    assert.equal(res.body.releasedRegistrations, 1);
    assert.equal((await session.call('GET', '/auth/me')).status, 401, 'the open session stops working');
    assert.equal((await session.call('POST', '/auth/refresh')).status, 401, 'and cannot be refreshed');
    const login = await ctx.login(student.email, PASSWORD);
    assert.equal(login.loginStatus, 403);

    const [rows] = await pool.query('SELECT id, status FROM event_registrations WHERE id IN (?)', [
      [seat.id, waitingReg.id, startedSeat.id],
    ]);
    const statusOf = (id) => rows.find((row) => row.id === id).status;
    assert.equal(statusOf(seat.id), 'cancelled');
    assert.equal(statusOf(waitingReg.id), 'confirmed', 'the next student got the seat');
    assert.equal(statusOf(startedSeat.id), 'confirmed');

    assert.equal((await setActive(admin, student.id, true)).body.user.isActive, true);
    assert.equal((await ctx.login(student.email, PASSWORD)).loginStatus, 200);
  });

  test('an admin cannot disable themselves', async () => {
    const res = await setActive(admin, admin.id, false);
    assert.equal(res.status, 409);
    assert.equal(res.body.error.code, 'CANNOT_CHANGE_SELF');
  });
});

describe('categories', () => {
  test('creating: the slug comes from the name; near-duplicates and symbol-only names are refused', async () => {
    const res = await createCategory(`Robotics & AI ${ctx.runId}`);
    assert.equal(res.status, 201);
    assert.equal(res.body.category.slug, `robotics-ai-${ctx.runId}`);

    const duplicate = await createCategory(`  robotics-AI ${ctx.runId} `);
    assert.equal(duplicate.status, 409);
    assert.equal(duplicate.body.error.details[0].field, 'name');

    const symbols = await createCategory('★★★');
    assert.equal(symbols.status, 400);
  });

  test('a rename shows up at once in the public list and on events; the slug stays', async () => {
    const { body } = await createCategory(`Chess ${ctx.runId}`);
    const eventId = await ctx.createEvent({ categoryId: body.category.id });
    await ctx.organizer.call('GET', `/events/${eventId}`); // puts the event in the cache

    const res = await admin.call('PUT', `/admin/categories/${body.category.id}`, {
      name: `Board Games ${ctx.runId}`,
      description: '',
    });

    assert.equal(res.status, 200);
    assert.equal(res.body.category.slug, body.category.slug);
    assert.equal(res.body.category.description, null);
    const event = await ctx.organizer.call('GET', `/events/${eventId}`);
    assert.equal(event.body.event.category.name, `Board Games ${ctx.runId}`);
    const list = await ctx.organizer.call('GET', '/categories');
    assert.ok(list.body.data.some((category) => category.name === `Board Games ${ctx.runId}`));
  });

  test('a category in use cannot be deleted; an unused one can', async () => {
    const used = await createCategory(`Used ${ctx.runId}`);
    await ctx.createEvent({ categoryId: used.body.category.id });
    const unused = await createCategory(`Unused ${ctx.runId}`);

    let res = await admin.call('DELETE', `/admin/categories/${used.body.category.id}`);
    assert.equal(res.status, 409);
    assert.equal(res.body.error.code, 'CATEGORY_IN_USE');

    res = await admin.call('DELETE', `/admin/categories/${unused.body.category.id}`);
    assert.equal(res.status, 204);
    res = await admin.call('DELETE', `/admin/categories/${unused.body.category.id}`);
    assert.equal(res.status, 404);
  });

  test('organizers cannot manage categories', async () => {
    const res = await ctx.organizer.call('POST', '/admin/categories', { name: `Nope ${ctx.runId}` });
    assert.equal(res.status, 403);
  });
});

describe('analytics', () => {
  test("a category's seats and registrations add up exactly", async () => {
    const { body } = await createCategory(`Analytics ${ctx.runId}`);
    const categoryId = body.category.id;
    const bigger = await ctx.createEvent({ capacity: 3, categoryId });
    const smaller = await ctx.createEvent({ capacity: 2, categoryId });
    const students = await ctx.createStudents(3);
    await register(students[0], bigger);
    await register(students[1], bigger);
    await register(students[2], smaller);

    const res = await admin.call('GET', '/admin/analytics?utcOffsetMinutes=300');

    assert.equal(res.status, 200);
    const row = res.body.categories.find((category) => category.id === categoryId);
    assert.deepEqual(row, { id: categoryId, name: `Analytics ${ctx.runId}`, events: 2, seats: 5, confirmed: 3 });
    assert.equal(res.body.registrationsByMonth.length, 6);
    assert.ok(res.body.registrationsByMonth.at(-1).count >= 3, 'this month includes the new registrations');
    assert.equal((await ctx.organizer.call('GET', '/admin/analytics')).status, 403);
  });

  test("months are the viewer's calendar months, even across a month boundary", () => {
    // 20:00 UTC on 30 November is already 01:00 on 1 December in Pakistan (UTC+5).
    const now = new Date('2026-11-30T20:00:00Z');

    const pakistan = recentMonths(300, now);
    assert.deepEqual(pakistan.months, ['2026-07', '2026-08', '2026-09', '2026-10', '2026-11', '2026-12']);
    assert.equal(pakistan.from.toISOString(), '2026-06-30T19:00:00.000Z', '1 July, midnight in Pakistan');

    assert.equal(recentMonths(0, now).months.at(-1), '2026-11');
  });
});
