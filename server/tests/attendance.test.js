import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import jsQR from 'jsqr';
import { PNG } from 'pngjs';
import { pool } from '../src/db/pool.js';
import { ticketQrPayload } from '../src/services/ticket.service.js';
import { days, fromNow, hours, TestContext } from './helpers.js';

const ctx = new TestContext();
before(() => ctx.start());
after(() => ctx.cleanup());

// Starts in 1 hour, so check-in (opens 2 hours before) is already open
// while registration (deadline in 30 minutes) still is too.
function createEventStartingSoon(options = {}) {
  return ctx.createEvent({
    startsAt: fromNow(hours(1)),
    registrationDeadline: fromNow(hours(0.5)),
    ...options,
  });
}

async function register(student, eventId) {
  const { body } = await student.call('POST', `/events/${eventId}/registrations`);
  return body.registration;
}

async function ticketCodeOf(registrationId) {
  const [[row]] = await pool.query('SELECT ticket_code FROM event_registrations WHERE id = ?', [registrationId]);
  return row.ticket_code;
}

function decodeQr(pngBuffer) {
  const png = PNG.sync.read(pngBuffer);
  return jsQR(new Uint8ClampedArray(png.data), png.width, png.height)?.data;
}

const checkIn = (organizer, eventId, code) => organizer.call('POST', `/organizer/events/${eventId}/check-in`, { code });

describe('ticket QR code', () => {
  test('the owner gets a PNG that decodes to the configured ticket payload', async () => {
    const eventId = await ctx.createEvent({ capacity: 5 });
    const [student] = await ctx.createStudents(1);
    const registration = await register(student, eventId);

    const res = await student.call('GET', `/me/registrations/${registration.id}/qr`);

    assert.equal(res.status, 200);
    assert.equal(res.headers.get('content-type'), 'image/png');
    assert.equal(decodeQr(res.body), ticketQrPayload(registration.ticketCode));
  });

  test("another student cannot fetch someone else's QR (404)", async () => {
    const eventId = await ctx.createEvent({ capacity: 5 });
    const [owner, intruder] = await ctx.createStudents(2);
    const registration = await register(owner, eventId);

    const res = await intruder.call('GET', `/me/registrations/${registration.id}/qr`);
    assert.equal(res.status, 404);
  });

  test('a waitlisted student has no ticket (409)', async () => {
    const eventId = await ctx.createEvent({ capacity: 1 });
    const [holder, waiting] = await ctx.createStudents(2);
    await register(holder, eventId);
    const registration = await register(waiting, eventId);

    const res = await waiting.call('GET', `/me/registrations/${registration.id}/qr`);
    assert.equal(res.status, 409);
    assert.equal(res.body.error.code, 'NO_TICKET');
  });
});

describe('check-in', () => {
  test('a typed code checks the student in; scanning again reports the original time', async () => {
    const eventId = await createEventStartingSoon();
    const [student] = await ctx.createStudents(1);
    const registration = await register(student, eventId);
    const typed = `${registration.ticketCode.slice(0, 4).toLowerCase()}-${registration.ticketCode.slice(4)}`;

    const first = await checkIn(ctx.organizer, eventId, typed);
    assert.equal(first.status, 200);
    assert.equal(first.body.result, 'checked_in');
    assert.equal(first.body.attendance.status, 'attended');
    assert.equal(first.body.registration.student.studentNumber.length > 0, true);

    // Scanned as a ticket link this time.
    const again = await checkIn(ctx.organizer, eventId, `https://eventhub.example.com/t/${registration.ticketCode}`);
    assert.equal(again.status, 200);
    assert.equal(again.body.result, 'already_checked_in');
    assert.equal(again.body.attendance.checkedInAt, first.body.attendance.checkedInAt);
  });

  test('simultaneous scans of one ticket: exactly 1 check-in, the rest "already checked in"', async () => {
    const SCANS = 20;
    const eventId = await createEventStartingSoon();
    const [student] = await ctx.createStudents(1);
    const registration = await register(student, eventId);
    await ctx.warmUpDatabasePool();

    const scans = await Promise.all(
      Array.from({ length: SCANS }, () => checkIn(ctx.organizer, eventId, registration.ticketCode)),
    );

    const count = (result) => scans.filter((res) => res.body.result === result).length;
    assert.equal(count('checked_in'), 1);
    assert.equal(count('already_checked_in'), SCANS - 1);
    const [[{ total }]] = await pool.query(
      'SELECT COUNT(*) AS total FROM event_attendance WHERE registration_id = ?',
      [registration.id],
    );
    assert.equal(total, 1);
  });

  test('rejects tickets that are invalid for this event', async () => {
    const eventId = await createEventStartingSoon({ capacity: 1, cancellationWindowHours: 0 });
    const otherEventId = await createEventStartingSoon();
    const [seated, waiting, cancelling, elsewhere] = await ctx.createStudents(4);
    const seatedReg = await register(seated, eventId);
    const waitingReg = await register(waiting, eventId);
    const elsewhereReg = await register(elsewhere, otherEventId);
    // Joins the waitlist, then leaves it, leaving a cancelled registration behind.
    const cancelledReg = await register(cancelling, eventId);
    await cancelling.call('POST', `/me/registrations/${cancelledReg.id}/cancel`);

    const cases = [
      [elsewhereReg.ticketCode, 404, 'TICKET_NOT_FOUND'],
      [await ticketCodeOf(cancelledReg.id), 409, 'TICKET_CANCELLED'],
      [await ticketCodeOf(waitingReg.id), 409, 'NOT_CONFIRMED'],
      ['https://example.com/not-a-ticket', 400, 'VALIDATION_ERROR'],
    ];
    for (const [code, status, errorCode] of cases) {
      const res = await checkIn(ctx.organizer, eventId, code);
      assert.equal(res.status, status, errorCode);
      assert.equal(res.body.error.code, errorCode);
    }

    const [[{ total }]] = await pool.query(
      'SELECT COUNT(*) AS total FROM event_attendance a JOIN event_registrations r ON r.id = a.registration_id WHERE r.event_id = ?',
      [eventId],
    );
    assert.equal(total, 0, 'no attendance rows written');
    assert.equal(seatedReg.status, 'confirmed');
  });

  test('check-in is closed until 2 hours before the start and after the end', async () => {
    const laterEventId = await ctx.createEvent({ startsAt: fromNow(days(3)) });
    const [student, other] = await ctx.createStudents(2);
    const tooEarly = await register(student, laterEventId);
    let res = await checkIn(ctx.organizer, laterEventId, tooEarly.ticketCode);
    assert.equal(res.status, 409);
    assert.equal(res.body.error.code, 'CHECK_IN_CLOSED');

    const endedEventId = await createEventStartingSoon();
    const tooLate = await register(other, endedEventId);
    await ctx.setEventTimes(endedEventId, { startsAt: fromNow(-hours(3)), endsAt: fromNow(-hours(1)) });
    res = await checkIn(ctx.organizer, endedEventId, tooLate.ticketCode);
    assert.equal(res.status, 409);
    assert.equal(res.body.error.code, 'CHECK_IN_CLOSED');
  });

  test('only the event organizer (or an admin) can check people in', async () => {
    const eventId = await createEventStartingSoon();
    const [student] = await ctx.createStudents(1);
    const otherOrganizer = await ctx.createUser('organizer');
    const registration = await register(student, eventId);

    assert.equal((await checkIn(student, eventId, registration.ticketCode)).status, 403);
    assert.equal((await checkIn(otherOrganizer, eventId, registration.ticketCode)).status, 403);
    const admin = await ctx.createUser('admin');
    assert.equal((await checkIn(admin, eventId, registration.ticketCode)).body.result, 'checked_in');
  });
});

describe('cancelling after check-in', () => {
  test('a checked-in student can no longer cancel, even with a 0-hour cancellation window', async () => {
    const eventId = await createEventStartingSoon({ cancellationWindowHours: 0 });
    const [student] = await ctx.createStudents(1);
    const registration = await register(student, eventId);
    await checkIn(ctx.organizer, eventId, registration.ticketCode);

    const res = await student.call('POST', `/me/registrations/${registration.id}/cancel`);

    assert.equal(res.status, 409);
    assert.equal(res.body.error.code, 'ALREADY_CHECKED_IN');
    const [[row]] = await pool.query('SELECT status FROM event_registrations WHERE id = ?', [registration.id]);
    assert.equal(row.status, 'confirmed');
  });
});

describe('marking attendance manually', () => {
  const mark = (organizer, eventId, registrationId, status) =>
    organizer.call('PUT', `/organizer/events/${eventId}/registrations/${registrationId}/attendance`, { status });

  test('no-show only once the event has started; attended once check-in is open', async () => {
    const eventId = await createEventStartingSoon();
    const [student] = await ctx.createStudents(1);
    const registration = await register(student, eventId);

    let res = await mark(ctx.organizer, eventId, registration.id, 'no_show');
    assert.equal(res.status, 409);
    assert.equal(res.body.error.code, 'EVENT_NOT_STARTED');

    await ctx.setEventTimes(eventId, { startsAt: fromNow(-hours(1)), endsAt: fromNow(hours(1)) });
    res = await mark(ctx.organizer, eventId, registration.id, 'no_show');
    assert.equal(res.body.attendance.status, 'no_show');
    assert.equal(res.body.attendance.checkedInAt, null);

    res = await mark(ctx.organizer, eventId, registration.id, 'attended');
    assert.equal(res.body.attendance.status, 'attended');
    assert.ok(res.body.attendance.checkedInAt);

    const mine = await student.call('GET', `/me/registrations/${registration.id}`);
    assert.equal(mine.body.registration.attendance.status, 'attended');
  });

  test('a waitlisted registration cannot be marked', async () => {
    const eventId = await createEventStartingSoon({ capacity: 1 });
    const [holder, waiting] = await ctx.createStudents(2);
    await register(holder, eventId);
    const waitingReg = await register(waiting, eventId);

    const res = await mark(ctx.organizer, eventId, waitingReg.id, 'attended');
    assert.equal(res.status, 409);
    assert.equal(res.body.error.code, 'NOT_CONFIRMED');
  });

  test('after the event, remaining confirmed students become no-shows in one call', async () => {
    const eventId = await createEventStartingSoon({ capacity: 3 });
    const [came, missedA, missedB] = await ctx.createStudents(3);
    const cameReg = await register(came, eventId);
    await register(missedA, eventId);
    await register(missedB, eventId);
    await checkIn(ctx.organizer, eventId, cameReg.ticketCode);

    let res = await ctx.organizer.call('POST', `/organizer/events/${eventId}/attendance/no-shows`);
    assert.equal(res.status, 409, 'not allowed before the event ends');
    assert.equal(res.body.error.code, 'EVENT_NOT_ENDED');

    await ctx.setEventTimes(eventId, { startsAt: fromNow(-hours(3)), endsAt: fromNow(-hours(1)) });
    res = await ctx.organizer.call('POST', `/organizer/events/${eventId}/attendance/no-shows`);
    assert.deepEqual(res.body, { markedNoShow: 2 });
    res = await ctx.organizer.call('POST', `/organizer/events/${eventId}/attendance/no-shows`);
    assert.deepEqual(res.body, { markedNoShow: 0 }, 'running it again changes nothing');

    const list = await ctx.organizer.call('GET', `/organizer/events/${eventId}/registrations`);
    const statuses = list.body.data.map((row) => row.attendance.status).sort();
    assert.deepEqual(statuses, ['attended', 'no_show', 'no_show']);
  });
});
