import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { TestContext } from './helpers.js';

const ctx = new TestContext();
before(() => ctx.start());
after(() => ctx.cleanup());

async function studentWithNotifications(count) {
  const [student] = await ctx.createStudents(1);
  for (let i = 0; i < count; i += 1) {
    const eventId = await ctx.createEvent();
    await student.call('POST', `/events/${eventId}/registrations`);
  }
  return student;
}

describe('notifications', () => {
  test('registering creates an unread notification, newest first', async () => {
    const student = await studentWithNotifications(2);

    const res = await student.call('GET', '/notifications');

    assert.equal(res.status, 200);
    assert.equal(res.body.unreadCount, 2);
    assert.equal(res.body.data.length, 2);
    assert.ok(res.body.data.every((n) => n.type === 'registration_confirmed' && n.readAt === null));
    assert.ok(res.body.data[0].id > res.body.data[1].id);
    assert.deepEqual((await student.call('GET', '/notifications/unread-count')).body, { unreadCount: 2 });
  });

  test('marking one as read lowers the unread count; marking all clears it', async () => {
    const student = await studentWithNotifications(3);
    const { body } = await student.call('GET', '/notifications');

    let res = await student.call('POST', `/notifications/${body.data[0].id}/read`);
    assert.deepEqual(res.body, { unreadCount: 2 });
    res = await student.call('POST', `/notifications/${body.data[0].id}/read`);
    assert.deepEqual(res.body, { unreadCount: 2 }, 'marking twice is harmless');

    res = await student.call('POST', '/notifications/read-all');
    assert.deepEqual(res.body, { unreadCount: 0 });
    const after = await student.call('GET', '/notifications');
    assert.ok(after.body.data.every((n) => n.readAt !== null));
  });

  test("a user cannot see or mark someone else's notifications", async () => {
    const owner = await studentWithNotifications(1);
    const [other] = await ctx.createStudents(1);
    const { body } = await owner.call('GET', '/notifications');

    assert.equal((await other.call('GET', '/notifications')).body.data.length, 0);
    const res = await other.call('POST', `/notifications/${body.data[0].id}/read`);
    assert.equal(res.status, 404);
    assert.equal((await owner.call('GET', '/notifications/unread-count')).body.unreadCount, 1);
  });

  test('organizers use the same endpoints; anonymous users get 401', async () => {
    assert.equal((await ctx.organizer.call('GET', '/notifications')).status, 200);
    const res = await fetch(`${ctx.baseUrl}/notifications`);
    assert.equal(res.status, 401);
  });
});
