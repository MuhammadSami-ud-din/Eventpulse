import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { pool } from '../src/db/pool.js';
import { days, fromNow, hours, TestContext } from './helpers.js';

const ctx = new TestContext();
before(() => ctx.start());
after(() => ctx.cleanup());

async function eventSeats(eventId) {
  const [[row]] = await pool.query(
    `SELECT e.confirmed_count AS confirmedCount,
            (SELECT COUNT(*) FROM event_registrations r
              WHERE r.event_id = e.id AND r.status = 'confirmed') AS confirmedRows
     FROM events e WHERE e.id = ?`,
    [eventId],
  );
  return row;
}

async function registrationRow(id) {
  const [[row]] = await pool.query(
    'SELECT status, waitlist_position, cancelled_at FROM event_registrations WHERE id = ?',
    [id],
  );
  return row;
}

async function notificationTypes(eventId, userId) {
  const [rows] = await pool.query(
    'SELECT type FROM notifications WHERE event_id = ? AND user_id = ? ORDER BY id',
    [eventId, userId],
  );
  return rows.map((row) => row.type);
}

describe('registration engine', () => {
  test('25 students racing for 1 seat: exactly 1 confirmed, 24 waitlisted at positions 1-24', async () => {
    const eventId = await ctx.createEvent({ capacity: 1 });
    const students = await ctx.createStudents(25);
    await ctx.warmUpDatabasePool();

    const responses = await Promise.all(
      students.map((student) => student.call('POST', `/events/${eventId}/registrations`)),
    );

    assert.ok(responses.every((res) => res.status === 201), 'every request should succeed');
    const registrations = responses.map((res) => res.body.registration);
    const confirmed = registrations.filter((r) => r.status === 'confirmed');
    const waitlisted = registrations.filter((r) => r.status === 'waitlisted');
    assert.equal(confirmed.length, 1);
    assert.equal(waitlisted.length, 24);

    const positions = waitlisted.map((r) => r.waitlistPosition).sort((a, b) => a - b);
    assert.deepEqual(positions, Array.from({ length: 24 }, (_, i) => i + 1));

    assert.deepEqual(await eventSeats(eventId), { confirmedCount: 1, confirmedRows: 1 });
  });

  test('one student sending 10 parallel requests: 1 created, 9 ALREADY_REGISTERED', async () => {
    const eventId = await ctx.createEvent({ capacity: 50 });
    const [student] = await ctx.createStudents(1);
    await ctx.warmUpDatabasePool();

    const responses = await Promise.all(
      Array.from({ length: 10 }, () => student.call('POST', `/events/${eventId}/registrations`)),
    );

    assert.equal(responses.filter((res) => res.status === 201).length, 1);
    const rejected = responses.filter((res) => res.status === 409);
    assert.equal(rejected.length, 9);
    assert.ok(rejected.every((res) => res.body.error.code === 'ALREADY_REGISTERED'));

    const [[{ total }]] = await pool.query(
      'SELECT COUNT(*) AS total FROM event_registrations WHERE event_id = ? AND user_id = ?',
      [eventId, student.id],
    );
    assert.equal(total, 1);
  });

  test('cancelling a confirmed seat outside the window: 409 and nothing changes', async () => {
    // Starts in 10 hours with a 24-hour window, so cancellations are already closed
    // while registration (deadline in 5 hours) is still open.
    const eventId = await ctx.createEvent({
      capacity: 5,
      startsAt: fromNow(hours(10)),
      registrationDeadline: fromNow(hours(5)),
      cancellationWindowHours: 24,
    });
    const [student] = await ctx.createStudents(1);
    const { body } = await student.call('POST', `/events/${eventId}/registrations`);
    const registrationId = body.registration.id;
    assert.equal(body.registration.canCancel, false);

    const seatsBefore = await eventSeats(eventId);
    const rowBefore = await registrationRow(registrationId);
    const notificationsBefore = await notificationTypes(eventId, student.id);

    const res = await student.call('POST', `/me/registrations/${registrationId}/cancel`);

    assert.equal(res.status, 409);
    assert.equal(res.body.error.code, 'CANCELLATION_CLOSED');
    assert.deepEqual(await registrationRow(registrationId), rowBefore);
    assert.deepEqual(await eventSeats(eventId), seatsBefore);
    assert.deepEqual(await notificationTypes(eventId, student.id), notificationsBefore);
  });

  test('cancelling inside the window promotes the first waitlisted student, who gets a ticket', async () => {
    const eventId = await ctx.createEvent({ capacity: 1, startsAt: fromNow(days(5)), cancellationWindowHours: 24 });
    const [holder, firstInLine, secondInLine] = await ctx.createStudents(3);
    // Sequential, so the queue order is known.
    const held = await holder.call('POST', `/events/${eventId}/registrations`);
    const first = await firstInLine.call('POST', `/events/${eventId}/registrations`);
    const second = await secondInLine.call('POST', `/events/${eventId}/registrations`);
    assert.equal(held.body.registration.status, 'confirmed');
    assert.equal(first.body.registration.waitlistPosition, 1);
    assert.equal(second.body.registration.waitlistPosition, 2);
    assert.equal(first.body.registration.ticketCode, null, 'waitlisted students have no valid ticket');

    const res = await holder.call('POST', `/me/registrations/${held.body.registration.id}/cancel`);
    assert.equal(res.status, 200);
    assert.equal(res.body.registration.status, 'cancelled');

    const promoted = await firstInLine.call('GET', `/me/registrations/${first.body.registration.id}`);
    assert.equal(promoted.body.registration.status, 'confirmed');
    assert.match(promoted.body.registration.ticketCode, /^[A-HJ-NP-Z2-9]{10}$/);
    assert.ok(promoted.body.registration.promotedAt);

    const stillWaiting = await secondInLine.call('GET', `/me/registrations/${second.body.registration.id}`);
    assert.equal(stillWaiting.body.registration.status, 'waitlisted');
    assert.equal(stillWaiting.body.registration.waitlistPosition, 1, 'the queue moves up');

    assert.deepEqual(await eventSeats(eventId), { confirmedCount: 1, confirmedRows: 1 });
    assert.deepEqual(await notificationTypes(eventId, holder.id), ['registration_confirmed', 'registration_cancelled']);
    assert.deepEqual(await notificationTypes(eventId, firstInLine.id), ['waitlisted', 'promoted']);
  });
});

describe('access control', () => {
  test("a student cannot view or cancel another student's registration (404)", async () => {
    const eventId = await ctx.createEvent({ capacity: 5 });
    const [owner, intruder] = await ctx.createStudents(2);
    const { body } = await owner.call('POST', `/events/${eventId}/registrations`);
    const registrationId = body.registration.id;

    const view = await intruder.call('GET', `/me/registrations/${registrationId}`);
    const cancel = await intruder.call('POST', `/me/registrations/${registrationId}/cancel`);

    assert.equal(view.status, 404);
    assert.equal(cancel.status, 404);
    assert.equal((await registrationRow(registrationId)).status, 'confirmed');
  });

  test('a student cannot call organizer or admin endpoints (403)', async () => {
    const eventId = await ctx.createEvent({ capacity: 5 });
    const [student] = await ctx.createStudents(1);

    const attempts = [
      ['GET', '/organizer/events'],
      ['GET', `/organizer/events/${eventId}`],
      ['GET', `/organizer/events/${eventId}/registrations`],
      ['PATCH', `/organizer/events/${eventId}`, { capacity: 1 }],
      ['POST', `/organizer/events/${eventId}/close`],
      ['POST', `/admin/events/${eventId}/approve`],
    ];
    for (const [method, path, body] of attempts) {
      const res = await student.call(method, path, body);
      assert.equal(res.status, 403, `${method} ${path}`);
      assert.equal(res.body.error.code, 'FORBIDDEN');
    }

    const [[event]] = await pool.query('SELECT status, capacity FROM events WHERE id = ?', [eventId]);
    assert.deepEqual(event, { status: 'published', capacity: 5 });
  });
});

// Runs last and reads the whole database (seed data included), so it also
// catches inconsistencies left behind by anything else, not just these tests.
describe('data consistency across all events', () => {
  async function offendingIds(sql) {
    const [rows] = await pool.query(sql);
    return rows.map((row) => row.id);
  }

  test('confirmed_count matches the number of confirmed registrations', async () => {
    const ids = await offendingIds(`
      SELECT e.id FROM events e
      WHERE e.confirmed_count <> (
        SELECT COUNT(*) FROM event_registrations r WHERE r.event_id = e.id AND r.status = 'confirmed')`);
    assert.deepEqual(ids, [], `events with a wrong seat count: ${ids}`);
  });

  test('no upcoming event has a free seat while someone is waitlisted', async () => {
    const ids = await offendingIds(`
      SELECT e.id FROM events e
      WHERE e.starts_at > UTC_TIMESTAMP()
        AND e.confirmed_count < e.capacity
        AND EXISTS (SELECT 1 FROM event_registrations r WHERE r.event_id = e.id AND r.status = 'waitlisted')`);
    assert.deepEqual(ids, [], `events with free seats and a waitlist: ${ids}`);
  });

  test('no student has two active registrations for the same event', async () => {
    const ids = await offendingIds(`
      SELECT event_id AS id FROM event_registrations
      WHERE status <> 'cancelled'
      GROUP BY event_id, user_id
      HAVING COUNT(*) > 1`);
    assert.deepEqual(ids, [], `events with duplicate active registrations: ${ids}`);
  });
});

describe("a student's registration list", () => {
  test('filters by time (upcoming/past), by event and by status', async () => {
    const [student] = await ctx.createStudents(1);
    const upcomingId = await ctx.createEvent();
    const pastId = await ctx.createEvent();
    const full = await ctx.createEvent({ capacity: 1 });
    const [holder] = await ctx.createStudents(1);
    await holder.call('POST', `/events/${full}/registrations`);
    for (const eventId of [upcomingId, pastId, full]) await student.call('POST', `/events/${eventId}/registrations`);
    await ctx.setEventTimes(pastId, { startsAt: fromNow(-days(2)), endsAt: fromNow(-days(2) + hours(2)) });

    const eventIds = async (query) =>
      (await student.call('GET', `/me/registrations?${query}`)).body.data.map((r) => r.event.id).sort();

    assert.deepEqual(await eventIds('scope=all'), [upcomingId, pastId, full].sort());
    assert.deepEqual(await eventIds('scope=upcoming'), [upcomingId, full].sort());
    assert.deepEqual(await eventIds('scope=past'), [pastId]);
    assert.deepEqual(await eventIds(`eventId=${upcomingId}`), [upcomingId]);
    assert.deepEqual(await eventIds('status=waitlisted'), [full]);
  });
});
