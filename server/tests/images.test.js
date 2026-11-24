import assert from 'node:assert/strict';
import { setTimeout as sleep } from 'node:timers/promises';
import { after, before, describe, test } from 'node:test';
import { PNG } from 'pngjs';
import { pool } from '../src/db/pool.js';
import { conditionalGet, TestContext } from './helpers.js';

const ctx = new TestContext();
before(() => ctx.start());
after(() => ctx.cleanup());

// A real 4x4 PNG, plus files that only start like a JPEG or WebP: the server
// checks the leading bytes, it does not decode images.
function pngBytes() {
  const png = new PNG({ width: 4, height: 4 });
  png.data.fill(200);
  return PNG.sync.write(png);
}
const jpegBytes = () => Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(60, 1)]);
const webpBytes = () => Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WEBPVP8 '), Buffer.alloc(40, 2)]);

const upload = (user, path, bytes, type = 'image/png') => user.call.raw('PUT', path, bytes, type);
// avatarUrl and coverUrl start with /api, which the test clients add themselves.
const apiPath = (url) => url.replace(/^\/api/, '');
const anonymousGet = (url) => fetch(`${ctx.baseUrl}${apiPath(url)}`);

describe('avatars', () => {
  test('a user uploads, replaces and removes their avatar; each version gets a new URL', async () => {
    const student = await ctx.createUser('student');

    const first = await upload(student, '/account/avatar', pngBytes());
    assert.equal(first.status, 200);
    assert.match(first.body.avatarUrl, new RegExp(`^/api/images/avatars/${student.id}\\?v=\\d+$`));
    assert.equal((await student.call('GET', '/auth/me')).body.user.avatarUrl, first.body.avatarUrl);

    const image = await student.call('GET', apiPath(first.body.avatarUrl));
    assert.equal(image.status, 200);
    assert.equal(image.headers.get('content-type'), 'image/png');
    assert.deepEqual(image.body, pngBytes());
    assert.match(image.headers.get('cache-control'), /^private/, "a student's avatar is not for shared caches");
    assert.ok(image.headers.get('etag'));

    await sleep(5);
    const second = await upload(student, '/account/avatar', webpBytes(), 'image/webp');
    assert.notEqual(second.body.avatarUrl, first.body.avatarUrl);
    assert.equal((await student.call('GET', apiPath(second.body.avatarUrl))).headers.get('content-type'), 'image/webp');

    assert.equal((await student.call('DELETE', '/account/avatar')).status, 204);
    assert.equal((await student.call('GET', apiPath(second.body.avatarUrl))).status, 404);
    assert.equal((await student.call('GET', '/auth/me')).body.user.avatarUrl, null);
  });

  test('the type comes from the bytes, not from what the client claims', async () => {
    const student = await ctx.createUser('student');

    const disguised = await upload(student, '/account/avatar', Buffer.from('<html><script>alert(1)</script></html>'));
    assert.equal(disguised.status, 400);
    assert.equal(disguised.body.error.code, 'UNSUPPORTED_IMAGE');

    const mislabelled = await upload(student, '/account/avatar', jpegBytes(), 'image/png');
    const image = await student.call('GET', apiPath(mislabelled.body.avatarUrl));
    assert.equal(image.headers.get('content-type'), 'image/jpeg', 'stored and served as what it really is');
  });

  test('size and type limits: over 1 MB is 413; SVG, GIF and JSON are refused', async () => {
    const student = await ctx.createUser('student');

    const tooBig = await upload(student, '/account/avatar', Buffer.concat([pngBytes(), Buffer.alloc(1024 * 1024)]));
    assert.equal(tooBig.status, 413);

    for (const type of ['image/svg+xml', 'image/gif']) {
      const res = await upload(student, '/account/avatar', Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>'), type);
      assert.equal(res.status, 415, type);
    }
    const json = await student.call('PUT', '/account/avatar', { image: 'data:image/png;base64,AAAA' });
    assert.equal(json.status, 400);
    assert.equal(json.body.error.code, 'IMAGE_REQUIRED');
  });

  test("a student's avatar is visible only to them, admins, and organizers of their events", async () => {
    const student = await ctx.createUser('student');
    const otherStudent = await ctx.createUser('student');
    const otherOrganizer = await ctx.createUser('organizer');
    const admin = await ctx.createUser('admin');
    const eventId = await ctx.createEvent();
    await student.call('POST', `/events/${eventId}/registrations`);
    const { avatarUrl } = (await upload(student, '/account/avatar', pngBytes())).body;
    const path = apiPath(avatarUrl);

    assert.equal((await anonymousGet(avatarUrl)).status, 404, 'anonymous');
    assert.equal((await otherStudent.call('GET', path)).status, 404, 'another student');
    assert.equal((await otherOrganizer.call('GET', path)).status, 404, 'an unrelated organizer');
    assert.equal((await ctx.organizer.call('GET', path)).status, 200, 'the organizer of their event');
    assert.equal((await admin.call('GET', path)).status, 200, 'an admin');
    const row = (await ctx.organizer.call('GET', `/organizer/events/${eventId}/registrations`)).body.data[0];
    assert.equal(row.student.avatarUrl, avatarUrl, 'shown in the registrations table');
  });

  test("organizers' avatars are public, cacheable, and answer 304 when unchanged", async () => {
    const organizer = await ctx.createUser('organizer');
    const { avatarUrl } = (await upload(organizer, '/account/avatar', pngBytes())).body;

    const res = await anonymousGet(avatarUrl);
    assert.equal(res.status, 200);
    assert.match(res.headers.get('cache-control'), /^public, max-age=\d+/);
    const again = await conditionalGet(`${ctx.baseUrl}${apiPath(avatarUrl)}`, res.headers.get('etag'));
    assert.equal(again.status, 304);
    assert.equal(again.body.length, 0);
  });

  test('changing an avatar needs a session; there is no way to name another user', async () => {
    const res = await fetch(`${ctx.baseUrl}/account/avatar`, { method: 'PUT', headers: { 'content-type': 'image/png' }, body: pngBytes() });
    assert.equal(res.status, 403, 'refused (no CSRF token, no session)');
    assert.equal((await fetch(`${ctx.baseUrl}/images/avatars/abc`)).status, 400);
  });
});

describe('event covers', () => {
  test("a draft's cover is private to its managers; once published it is public", async () => {
    const eventId = await ctx.createEvent({ status: 'draft' });

    const res = await upload(ctx.organizer, `/organizer/events/${eventId}/cover`, jpegBytes(), 'image/jpeg');
    assert.equal(res.status, 200);
    const { coverUrl } = res.body;
    assert.equal((await ctx.organizer.call('GET', `/organizer/events/${eventId}`)).body.event.coverUrl, coverUrl);
    assert.equal((await anonymousGet(coverUrl)).status, 404, 'draft: hidden from the public');
    assert.equal((await ctx.organizer.call('GET', apiPath(coverUrl))).status, 200, 'but the organizer can preview it');

    await pool.query("UPDATE events SET status = 'published' WHERE id = ?", [eventId]);
    const published = await anonymousGet(coverUrl);
    assert.equal(published.status, 200);
    assert.match(published.headers.get('cache-control'), /^public/);
    assert.equal((await (await fetch(`${ctx.baseUrl}/events/${eventId}`)).json()).event.coverUrl, coverUrl);
  });

  test('only the event organizer or an admin can change a cover', async () => {
    const eventId = await ctx.createEvent();
    const otherOrganizer = await ctx.createUser('organizer');
    const [student] = await ctx.createStudents(1);
    const admin = await ctx.createUser('admin');

    assert.equal((await upload(otherOrganizer, `/organizer/events/${eventId}/cover`, pngBytes())).status, 403);
    assert.equal((await upload(student, `/organizer/events/${eventId}/cover`, pngBytes())).status, 403);
    assert.equal((await upload(admin, `/organizer/events/${eventId}/cover`, pngBytes())).status, 200);
    assert.equal((await otherOrganizer.call('DELETE', `/organizer/events/${eventId}/cover`)).status, 403);
  });

  test('removing a cover clears it from the event (the cache is refreshed)', async () => {
    const eventId = await ctx.createEvent();
    await upload(ctx.organizer, `/organizer/events/${eventId}/cover`, pngBytes());
    await fetch(`${ctx.baseUrl}/events/${eventId}`); // cached with the cover

    assert.equal((await ctx.organizer.call('DELETE', `/organizer/events/${eventId}/cover`)).status, 204);
    assert.equal((await (await fetch(`${ctx.baseUrl}/events/${eventId}`)).json()).event.coverUrl, null);
  });
});
