import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { fromNow, hours, TestContext } from './helpers.js';

const ctx = new TestContext();
before(() => ctx.start());
after(() => ctx.cleanup());

const UTF8_BOM = '﻿';

async function register(student, eventId) {
  const { body } = await student.call('POST', `/events/${eventId}/registrations`);
  return body.registration;
}

describe('event stats', () => {
  test('counts registrations and attendance for the event', async () => {
    const eventId = await ctx.createEvent({
      capacity: 3,
      startsAt: fromNow(hours(1)),
      registrationDeadline: fromNow(hours(0.5)),
    });
    const [came, missed, unmarked, waiting, leaving] = await ctx.createStudents(5);
    const cameReg = await register(came, eventId);
    const missedReg = await register(missed, eventId);
    await register(unmarked, eventId);
    await register(waiting, eventId);
    const leavingReg = await register(leaving, eventId);
    await leaving.call('POST', `/me/registrations/${leavingReg.id}/cancel`);

    await ctx.setEventTimes(eventId, { startsAt: fromNow(-hours(1)), endsAt: fromNow(hours(1)) });
    const mark = (registrationId, status) =>
      ctx.organizer.call('PUT', `/organizer/events/${eventId}/registrations/${registrationId}/attendance`, { status });
    await mark(cameReg.id, 'attended');
    await mark(missedReg.id, 'no_show');

    const res = await ctx.organizer.call('GET', `/organizer/events/${eventId}/stats`);

    assert.equal(res.status, 200);
    const { registrationsByDay, ...counts } = res.body.stats;
    assert.deepEqual(counts, {
      capacity: 3,
      confirmed: 3,
      waitlisted: 1,
      cancelled: 1,
      attended: 1,
      noShows: 1,
      notMarked: 1,
      attendanceRate: 0.5,
    });
    assert.equal(registrationsByDay.reduce((sum, day) => sum + day.count, 0), 5);
  });

  test("registrations per day are bucketed in the viewer's time zone", async () => {
    const eventId = await ctx.createEvent();
    const [student] = await ctx.createStudents(1);
    await register(student, eventId);

    for (const offset of [-720, 0, 300, 840]) {
      const res = await ctx.organizer.call('GET', `/organizer/events/${eventId}/stats?utcOffsetMinutes=${offset}`);
      const expectedDay = new Date(Date.now() + offset * 60 * 1000).toISOString().slice(0, 10);
      assert.deepEqual(res.body.stats.registrationsByDay, [{ date: expectedDay, count: 1 }], `offset ${offset}`);
    }
  });

  test('stats are only for the event owner (or an admin)', async () => {
    const eventId = await ctx.createEvent();
    const [student] = await ctx.createStudents(1);
    const otherOrganizer = await ctx.createUser('organizer');
    assert.equal((await student.call('GET', `/organizer/events/${eventId}/stats`)).status, 403);
    assert.equal((await otherOrganizer.call('GET', `/organizer/events/${eventId}/stats`)).status, 403);
  });
});

describe('CSV export', () => {
  test('exports every registration with safe, spreadsheet-ready cells', async () => {
    const eventId = await ctx.createEvent({ capacity: 1 });
    const attacker = await ctx.createUser('student', { fullName: '=HYPERLINK("http://evil.example","Click me")' });
    const urdu = await ctx.createUser('student', { fullName: 'مریم, Khan' });
    await register(attacker, eventId);
    await register(urdu, eventId);

    const res = await ctx.organizer.call('GET', `/organizer/events/${eventId}/registrations/export`);

    assert.equal(res.status, 200);
    assert.match(res.headers.get('content-type'), /^text\/csv; charset=utf-8/);
    assert.match(res.headers.get('content-disposition'), /^attachment; filename="?test-event-[a-z0-9]+-registrations\.csv"?$/);
    const csv = res.body.toString('utf8');
    assert.ok(csv.startsWith(UTF8_BOM), 'BOM so Excel reads UTF-8');
    const lines = csv.slice(1).trimEnd().split('\r\n');
    assert.equal(lines.length, 3, 'header + 2 rows');
    assert.ok(lines[0].startsWith('Name,Email,Student number,Department,Status,Waitlist position'));
    assert.ok(lines[1].startsWith(`"'=HYPERLINK(""http://evil.example"",""Click me"")",`), 'formula neutralised and quoted');
    assert.match(lines[1], /,confirmed,,/);
    assert.ok(lines[2].startsWith('"مریم, Khan",'), 'comma in a name is quoted');
    assert.match(lines[2], /,waitlisted,1,/);
  });

  test('only the event owner (or an admin) can export', async () => {
    const eventId = await ctx.createEvent();
    const [student] = await ctx.createStudents(1);
    const otherOrganizer = await ctx.createUser('organizer');
    const admin = await ctx.createUser('admin');
    const path = `/organizer/events/${eventId}/registrations/export`;
    assert.equal((await student.call('GET', path)).status, 403);
    assert.equal((await otherOrganizer.call('GET', path)).status, 403);
    assert.equal((await admin.call('GET', path)).status, 200);
  });
});

describe('admin users list', () => {
  test('admins can search and filter users; no password data is returned', async () => {
    const admin = await ctx.createUser('admin');
    await ctx.createStudents(2);

    const all = await admin.call('GET', `/admin/users?q=test-${ctx.runId}&pageSize=50`);
    const students = await admin.call('GET', `/admin/users?q=test-${ctx.runId}&role=student&pageSize=50`);

    assert.equal(all.status, 200);
    assert.ok(all.body.data.length >= 4, 'organizer, admin and students from this run');
    assert.ok(students.body.data.every((user) => user.role === 'student'));
    assert.ok(!JSON.stringify(all.body).includes('password'));
  });

  test('students and organizers cannot list users', async () => {
    const [student] = await ctx.createStudents(1);
    assert.equal((await student.call('GET', '/admin/users')).status, 403);
    assert.equal((await ctx.organizer.call('GET', '/admin/users')).status, 403);
  });
});

describe("an event's registrations table", () => {
  test('searches by name, email or student number, and filters by status', async () => {
    const eventId = await ctx.createEvent({ capacity: 1 });
    const seated = await ctx.createUser('student', { fullName: 'Hira Javed Test' });
    const waiting = await ctx.createUser('student', { fullName: 'Omar Farooq Test' });
    await seated.call('POST', `/events/${eventId}/registrations`);
    await waiting.call('POST', `/events/${eventId}/registrations`);

    const names = async (query) =>
      (await ctx.organizer.call('GET', `/organizer/events/${eventId}/registrations?${query}`)).body.data.map(
        (row) => row.student.fullName,
      );

    assert.deepEqual(await names('q=hira'), ['Hira Javed Test']);
    assert.deepEqual(await names(`q=${encodeURIComponent(waiting.email)}`), ['Omar Farooq Test']);
    assert.deepEqual(await names('status=waitlisted'), ['Omar Farooq Test']);
    assert.deepEqual(await names('q=100%25'), [], 'a "%" is matched literally, not as a wildcard');
  });
});
