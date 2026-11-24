import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { fromNow, hours, TestContext } from './helpers.js';

const ctx = new TestContext();
before(() => ctx.start());
after(() => ctx.cleanup());

// The public status page is used without logging in.
async function lookUp(code) {
  const res = await fetch(`${ctx.baseUrl}/tickets/${encodeURIComponent(code)}`);
  return { status: res.status, body: await res.json() };
}

async function registeredStudent(eventOptions) {
  const eventId = await ctx.createEvent(eventOptions);
  const [student] = await ctx.createStudents(1);
  const { body } = await student.call('POST', `/events/${eventId}/registrations`);
  return { eventId, student, registration: body.registration };
}

describe('public ticket status', () => {
  test('anyone with the code sees the ticket status and event, but nothing about the holder', async () => {
    const { registration } = await registeredStudent();

    const res = await lookUp(registration.ticketCode.toLowerCase());

    assert.equal(res.status, 200);
    assert.equal(res.body.ticket.status, 'confirmed');
    assert.equal(res.body.ticket.checkedInAt, null);
    assert.equal(res.body.ticket.event.title, registration.event.title);
    assert.deepEqual(Object.keys(res.body.ticket).sort(), ['checkedInAt', 'event', 'status']);
    assert.ok(!/email|fullName|studentNumber|user/i.test(JSON.stringify(res.body)), 'no personal data');
  });

  test('shows when the ticket was checked in, and that a cancelled ticket is cancelled', async () => {
    const soon = { startsAt: fromNow(hours(1)), registrationDeadline: fromNow(hours(0.5)), cancellationWindowHours: 0 };
    const checkedIn = await registeredStudent(soon);
    await ctx.organizer.call('POST', `/organizer/events/${checkedIn.eventId}/check-in`, {
      code: checkedIn.registration.ticketCode,
    });
    const cancelled = await registeredStudent();
    await cancelled.student.call('POST', `/me/registrations/${cancelled.registration.id}/cancel`);

    assert.ok((await lookUp(checkedIn.registration.ticketCode)).body.ticket.checkedInAt);
    assert.equal((await lookUp(cancelled.registration.ticketCode)).body.ticket.status, 'cancelled');
  });

  test('an unknown code is a 404; something that is not a code is a 400', async () => {
    assert.equal((await lookUp('ABCDEFGH23')).status, 404);
    assert.equal((await lookUp('not-a-ticket')).status, 400);
  });
});

describe('check-in accepts both QR formats', () => {
  test('a bare code and a ticket link both check the student in', async () => {
    const soon = { startsAt: fromNow(hours(1)), registrationDeadline: fromNow(hours(0.5)) };
    const viaCode = await registeredStudent(soon);
    const viaLink = await registeredStudent(soon);
    const checkIn = (eventId, code) => ctx.organizer.call('POST', `/organizer/events/${eventId}/check-in`, { code });

    const byCode = await checkIn(viaCode.eventId, viaCode.registration.ticketCode);
    const byLink = await checkIn(viaLink.eventId, `https://eventhub.example.com/t/${viaLink.registration.ticketCode}`);

    assert.equal(byCode.body.result, 'checked_in');
    assert.equal(byLink.body.result, 'checked_in');
  });
});
