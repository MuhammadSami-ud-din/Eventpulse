import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { pool } from '../src/db/pool.js';
import { days, fromNow, hours, TestContext } from './helpers.js';

const ctx = new TestContext();
before(() => ctx.start());
after(() => ctx.cleanup());

const PASSWORD = 'Original@123';
const NEW_PASSWORD = 'Changed@456';

describe('profile', () => {
  test('a user can update their name and department, and nothing else', async () => {
    const student = await ctx.createUser('student');

    const res = await student.call('PATCH', '/auth/me', {
      fullName: '  Renamed Student  ',
      department: '',
      role: 'admin',
      email: 'hijack@eventhub.test',
    });

    assert.equal(res.status, 200);
    assert.equal(res.body.user.fullName, 'Renamed Student');
    assert.equal(res.body.user.department, null, 'an empty department clears it');
    assert.equal(res.body.user.role, 'student');
    assert.equal(res.body.user.email, student.email);
    assert.ok(!('passwordHash' in res.body.user) && !JSON.stringify(res.body).includes('password'));
  });

  test('invalid profile input is rejected with field details', async () => {
    const student = await ctx.createUser('student');
    const res = await student.call('PATCH', '/auth/me', { fullName: 'X', department: 'y'.repeat(101) });
    assert.equal(res.status, 400);
    assert.deepEqual(res.body.error.details.map((d) => d.field).sort(), ['department', 'fullName']);
  });
});

describe('changing password', () => {
  test('a wrong current password is a 400 on that field (not a 401 that looks like a dead session)', async () => {
    const user = await ctx.createUser('student', { password: PASSWORD });
    const session = await ctx.login(user.email, PASSWORD);

    const res = await session.call('POST', '/auth/password', { currentPassword: 'Wrong@123', newPassword: NEW_PASSWORD });

    assert.equal(res.status, 400);
    assert.equal(res.body.error.details[0].field, 'currentPassword');
  });

  test('the new password must meet the policy and differ from the old one', async () => {
    const user = await ctx.createUser('student', { password: PASSWORD });
    const session = await ctx.login(user.email, PASSWORD);

    for (const newPassword of ['short', 'alllowercase1', PASSWORD]) {
      const res = await session.call('POST', '/auth/password', { currentPassword: PASSWORD, newPassword });
      assert.equal(res.status, 400, newPassword);
      assert.equal(res.body.error.details[0].field, 'newPassword');
    }
  });

  test('success keeps this session, logs out other devices, and swaps the password', async () => {
    const user = await ctx.createUser('student', { password: PASSWORD });
    const laptop = await ctx.login(user.email, PASSWORD);
    const phone = await ctx.login(user.email, PASSWORD);
    assert.equal(laptop.loginStatus, 200);

    const res = await laptop.call('POST', '/auth/password', { currentPassword: PASSWORD, newPassword: NEW_PASSWORD });
    assert.equal(res.status, 200);

    assert.equal((await laptop.call('GET', '/auth/me')).status, 200, 'this device stays logged in');
    assert.equal((await laptop.call('POST', '/auth/refresh')).status, 200, 'with a working refresh token');
    assert.equal((await phone.call('POST', '/auth/refresh')).status, 401, 'other devices are logged out');

    assert.equal((await ctx.login(user.email, PASSWORD)).loginStatus, 401);
    assert.equal((await ctx.login(user.email, NEW_PASSWORD)).loginStatus, 200);
  });
});

describe('account summary', () => {
  test('a student sees their upcoming and past events and attendance', async () => {
    const student = await ctx.createUser('student');
    const organizer = await ctx.createUser('organizer');
    const upcomingId = await ctx.createEvent();
    const pastId = await ctx.createEvent();
    await student.call('POST', `/events/${upcomingId}/registrations`);
    const { body } = await student.call('POST', `/events/${pastId}/registrations`);
    await ctx.setEventTimes(pastId, { startsAt: fromNow(-days(3)), endsAt: fromNow(-days(3) + hours(2)) });
    await pool.query(
      "INSERT INTO event_attendance (registration_id, status, checked_in_at, marked_by) VALUES (?, 'attended', UTC_TIMESTAMP(), ?)",
      [body.registration.id, organizer.id],
    );

    const { summary } = (await student.call('GET', '/account/summary')).body;

    assert.deepEqual(summary.stats, { upcoming: 1, past: 1, attended: 1, noShows: 0, attendanceRate: 1 });
    assert.deepEqual(summary.upcoming.map((r) => r.event.id), [upcomingId]);
    assert.deepEqual(summary.recent.map((r) => r.event.id), [pastId]);
  });

  test('an organizer sees counts of their own events', async () => {
    const organizer = await ctx.createUser('organizer');
    await ctx.createEvent({ organizerId: organizer.id });
    await ctx.createEvent({ organizerId: organizer.id, status: 'draft' });

    const { summary } = (await organizer.call('GET', '/account/summary')).body;

    assert.equal(summary.stats.total, 2);
    assert.equal(summary.stats.published, 1);
    assert.equal(summary.stats.drafts, 1);
    assert.equal(summary.upcomingEvents.length, 2);
  });

  test('the summary needs a session', async () => {
    assert.equal((await fetch(`${ctx.baseUrl}/account/summary`)).status, 401);
  });
});
