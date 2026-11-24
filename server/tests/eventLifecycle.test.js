import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { pool } from '../src/db/pool.js';
import { days, fromNow, hours, TestContext } from './helpers.js';

const ctx = new TestContext();
let admin;
before(async () => {
  await ctx.start();
  admin = await ctx.createUser('admin');
});
after(() => ctx.cleanup());

function eventFields(overrides = {}) {
  const startsAt = fromNow(days(10));
  return {
    title: `Lifecycle event ${ctx.runId}`,
    description: 'Walks through every status change.',
    venue: 'Test Lab',
    categoryId: ctx.categoryIds[0],
    startsAt: startsAt.toISOString(),
    endsAt: new Date(startsAt.getTime() + hours(2)).toISOString(),
    registrationDeadline: new Date(startsAt.getTime() - hours(2)).toISOString(),
    capacity: 10,
    ...overrides,
  };
}

async function createDraft(organizer = ctx.organizer, overrides) {
  const res = await organizer.call('POST', '/organizer/events', eventFields(overrides));
  assert.equal(res.status, 201, JSON.stringify(res.body));
  ctx.eventIds.push(res.body.event.id);
  return res.body.event;
}

const action = (user, eventId, name, body) => user.call('POST', `/organizer/events/${eventId}/${name}`, body);
const review = (eventId, name, body) => admin.call('POST', `/admin/events/${eventId}/${name}`, body);
const statusOf = async (eventId) => (await ctx.organizer.call('GET', `/organizer/events/${eventId}`)).body.event.status;

async function latestNotification(user) {
  const [[row]] = await pool.query(
    'SELECT type, message FROM notifications WHERE user_id = ? ORDER BY id DESC LIMIT 1',
    [user.id],
  );
  return row;
}

describe('from draft to published', () => {
  test('draft → submitted (pending) → approved (published) → closed → reopened', async () => {
    const event = await createDraft();
    assert.equal(event.status, 'draft');
    assert.equal((await fetch(`${ctx.baseUrl}/events/${event.id}`)).status, 404, 'drafts are private');

    assert.equal((await action(ctx.organizer, event.id, 'publish')).body.event.status, 'pending');
    assert.equal((await review(event.id, 'approve')).body.event.status, 'published');
    assert.equal((await latestNotification(ctx.organizer)).type, 'event_approved');
    assert.equal((await fetch(`${ctx.baseUrl}/events/${event.id}`)).status, 200, 'now public');

    assert.equal((await action(ctx.organizer, event.id, 'close')).body.event.status, 'closed');
    assert.equal((await action(ctx.organizer, event.id, 'publish')).body.event.status, 'published', 'reopened without review');
  });

  test('a rejection needs a reason, which reaches the organizer; editing turns it back into a draft', async () => {
    const event = await createDraft();
    await action(ctx.organizer, event.id, 'publish');

    assert.equal((await review(event.id, 'reject', { reason: 'no' })).status, 400, 'too short');
    const rejected = await review(event.id, 'reject', { reason: 'Please add the room number.' });
    assert.equal(rejected.body.event.status, 'rejected');
    assert.match((await latestNotification(ctx.organizer)).message, /Please add the room number\./);

    const edited = await ctx.organizer.call('PATCH', `/organizer/events/${event.id}`, { venue: 'Test Lab, Room 4' });
    assert.equal(edited.body.event.status, 'draft');
    assert.equal(edited.body.event.rejectionReason ?? null, null);
  });

  test("an admin's own event skips the approval queue", async () => {
    const event = await createDraft(admin);
    assert.equal((await action(admin, event.id, 'publish')).body.event.status, 'published');
  });

  test('only a pending event can be reviewed, and only a published one closed', async () => {
    const event = await createDraft();
    for (const res of [await review(event.id, 'approve'), await action(ctx.organizer, event.id, 'close')]) {
      assert.equal(res.status, 409);
      assert.equal(res.body.error.code, 'INVALID_STATUS');
    }
  });

  test('an event whose registration deadline has passed cannot be published', async () => {
    const event = await createDraft();
    await pool.query('UPDATE events SET registration_deadline = ? WHERE id = ?', [fromNow(-hours(1)), event.id]);
    const res = await action(ctx.organizer, event.id, 'publish');
    assert.equal(res.status, 409);
    assert.equal(res.body.error.code, 'DEADLINE_PASSED');
  });
});

describe('editing', () => {
  const edit = (eventId, patch) => ctx.organizer.call('PATCH', `/organizer/events/${eventId}`, patch);

  test('schedule rules are checked against the event as it would be after the edit', async () => {
    const event = await createDraft();
    // Ends before the event's (unchanged) start time.
    const res = await edit(event.id, { endsAt: fromNow(days(9)).toISOString() });
    assert.equal(res.status, 400);
    assert.deepEqual(res.body.error.details.map((detail) => detail.field), ['endsAt']);
    assert.equal((await edit(event.id, {})).status, 400, 'an empty edit is refused');
  });

  test('capacity cannot drop below the confirmed seats; raising it moves the waitlist up', async () => {
    const eventId = await ctx.createEvent({ capacity: 2 });
    const students = await ctx.createStudents(3);
    for (const student of students) await student.call('POST', `/events/${eventId}/registrations`);

    const tooLow = await edit(eventId, { capacity: 1 });
    assert.equal(tooLow.status, 409);
    assert.equal(tooLow.body.error.code, 'CAPACITY_TOO_LOW');

    const raised = await edit(eventId, { capacity: 3 });
    assert.equal(raised.status, 200);
    assert.equal(raised.body.event.seatsLeft, 0, 'the waiting student took the new seat');
    assert.equal(raised.body.event.waitlistCount, 0);
  });

  test('an event that has started cannot be edited', async () => {
    const eventId = await ctx.createEvent();
    await ctx.setEventTimes(eventId, { startsAt: fromNow(-hours(1)), endsAt: fromNow(hours(1)) });
    const res = await edit(eventId, { venue: 'Somewhere else' });
    assert.equal(res.status, 409);
    assert.equal(res.body.error.code, 'EVENT_STARTED');
  });

  test('an unknown category is reported on the categoryId field', async () => {
    const res = await ctx.organizer.call('POST', '/organizer/events', eventFields({ categoryId: 4294967295 }));
    assert.equal(res.status, 400);
    assert.equal(res.body.error.details[0].field, 'categoryId');
  });
});

describe('ownership and deletion', () => {
  test("another organizer can neither see nor change someone else's event", async () => {
    const event = await createDraft();
    const other = await ctx.createUser('organizer');

    for (const res of [
      await other.call('GET', `/organizer/events/${event.id}`),
      await other.call('PATCH', `/organizer/events/${event.id}`, { venue: 'Hijacked' }),
      await other.call('DELETE', `/organizer/events/${event.id}`),
      await action(other, event.id, 'publish'),
    ]) {
      assert.equal(res.status, 403);
    }
    assert.equal(await statusOf(event.id), 'draft');
  });

  test('an organizer lists only their own events; an admin sees everyone’s', async () => {
    const mine = await createDraft();
    const other = await ctx.createUser('organizer');
    const theirs = await createDraft(other);

    const ownList = (await ctx.organizer.call('GET', '/organizer/events?pageSize=50&status=draft')).body.data.map((e) => e.id);
    assert.ok(ownList.includes(mine.id) && !ownList.includes(theirs.id));
    const adminList = (await admin.call('GET', `/organizer/events?pageSize=50&q=${ctx.runId}`)).body.data.map((e) => e.id);
    assert.ok(adminList.includes(mine.id) && adminList.includes(theirs.id));
  });

  test('unpublished events can be deleted; a published one must be closed instead', async () => {
    const draft = await createDraft();
    assert.equal((await ctx.organizer.call('DELETE', `/organizer/events/${draft.id}`)).status, 204);
    assert.equal((await ctx.organizer.call('GET', `/organizer/events/${draft.id}`)).status, 404);

    const publishedId = await ctx.createEvent();
    const res = await ctx.organizer.call('DELETE', `/organizer/events/${publishedId}`);
    assert.equal(res.status, 409);
    assert.equal(res.body.error.code, 'INVALID_STATUS');
  });
});
