import assert from 'node:assert/strict';
import http from 'node:http';
import { after, before, describe, test } from 'node:test';
import { days, fromNow, hours, TestContext } from './helpers.js';

const ctx = new TestContext();
let categorySlug;
before(async () => {
  await ctx.start();
  categorySlug = `test-${ctx.runId}`;
});
after(() => ctx.cleanup());

// Public endpoints need no login, so these use plain fetch like a visitor would.
async function get(path) {
  const res = await fetch(`${ctx.baseUrl}${path}`);
  return { status: res.status, headers: res.headers, body: await res.json() };
}

// The ids of this file's events that a public list returns (the database is
// shared with the seed and with other test files running at the same time).
async function listIds(query = '') {
  const res = await get(`/events?category=${categorySlug}&pageSize=50${query}`);
  assert.equal(res.status, 200, res.body?.error?.message);
  return res.body.data.map((event) => event.id);
}

describe('what the public can see', () => {
  test('only published and closed events are listed or viewable; the rest are 404', async () => {
    const ids = {};
    for (const status of ['draft', 'pending', 'rejected', 'published', 'closed']) {
      ids[status] = await ctx.createEvent({ status });
    }

    assert.deepEqual((await listIds()).sort(), [ids.published, ids.closed].sort());
    for (const [status, id] of Object.entries(ids)) {
      const expected = status === 'published' || status === 'closed' ? 200 : 404;
      assert.equal((await get(`/events/${id}`)).status, expected, status);
    }
  });

  test('events that have ended drop off the list, unless a date range asks for them', async () => {
    const ended = await ctx.createEvent();
    await ctx.setEventTimes(ended, { startsAt: fromNow(-days(3)), endsAt: fromNow(-days(3) + hours(2)) });

    assert.ok(!(await listIds()).includes(ended));
    const from = encodeURIComponent(fromNow(-days(7)).toISOString());
    assert.ok((await listIds(`&from=${from}`)).includes(ended));
    assert.equal((await get(`/events/${ended}`)).status, 200, 'its page stays reachable');
  });

  test('an event shows seats left and the waitlist length, but nothing about who registered', async () => {
    const eventId = await ctx.createEvent({ capacity: 1 });
    const [first, second] = await ctx.createStudents(2);
    await first.call('POST', `/events/${eventId}/registrations`);
    await second.call('POST', `/events/${eventId}/registrations`);

    const { body } = await get(`/events/${eventId}`);

    assert.equal(body.event.seatsLeft, 0);
    assert.equal(body.event.waitlistCount, 1);
    assert.ok(!JSON.stringify(body).includes(first.email), 'no student data');
    assert.equal(body.event.organizer.email, undefined, 'no organizer email either');
  });
});

describe('filtering, sorting and paging', () => {
  let soon;
  let later;
  let popular;
  before(async () => {
    soon = await ctx.createEvent({ startsAt: fromNow(days(3)), title: `Robotics night ${ctx.runId}` });
    later = await ctx.createEvent({ startsAt: fromNow(days(20)), title: `Poetry evening ${ctx.runId}` });
    popular = await ctx.createEvent({ startsAt: fromNow(days(10)), title: `Chess open ${ctx.runId}` });
    const students = await ctx.createStudents(2);
    for (const student of students) await student.call('POST', `/events/${popular}/registrations`);
  });

  const only = (ids) => ids.filter((id) => [soon, later, popular].includes(id));

  test('search matches words in the title; common words like "the" do not break it', async () => {
    assert.deepEqual(only(await listIds('&q=robotics')), [soon]);
    assert.deepEqual(only(await listIds('&q=the%20robotics')), [soon]);
    assert.deepEqual(only(await listIds('&q=nothing-like-this')), []);
  });

  test('a date range keeps events that overlap it', async () => {
    const to = encodeURIComponent(fromNow(days(12)).toISOString());
    assert.deepEqual(only(await listIds(`&to=${to}`)), [soon, popular]);
  });

  test('sort orders: soonest, latest, most popular', async () => {
    assert.deepEqual(only(await listIds('&sort=date')), [soon, popular, later]);
    assert.deepEqual(only(await listIds('&sort=date_desc')), [later, popular, soon]);
    assert.equal(only(await listIds('&sort=popular'))[0], popular);
  });

  test('pages split the results and report the totals', async () => {
    const all = await listIds('&sort=date');
    const page = await get(`/events?category=${categorySlug}&sort=date&pageSize=1&page=2`);

    assert.equal(page.body.data.length, 1);
    assert.equal(page.body.data[0].id, all[1]);
    assert.deepEqual(page.body.pagination, { page: 2, pageSize: 1, total: all.length, totalPages: all.length });
  });

  test('an unknown category simply matches nothing', async () => {
    const res = await get('/events?category=no-such-category');
    assert.equal(res.status, 200);
    assert.equal(res.body.data.length, 0);
  });
});

// fetch() cannot test this: following the Fetch standard, a hand-set
// If-None-Match makes it add "Cache-Control: no-cache", which rightly tells the
// server to send everything again. node:http sends only what it is given.
function conditionalGet(path, etag) {
  const url = new URL(`${ctx.baseUrl}${path}`);
  return new Promise((resolve, reject) => {
    http
      .get(url, { headers: { 'if-none-match': etag } }, (res) => {
        let body = '';
        res.on('data', (chunk) => (body += chunk));
        res.on('end', () => resolve({ status: res.statusCode, body: body && JSON.parse(body) }));
      })
      .on('error', reject);
  });
}

describe('caching', () => {
  test('an unchanged event answers 304; after a registration the new seat count comes back at once', async () => {
    const eventId = await ctx.createEvent({ capacity: 5 });
    const first = await get(`/events/${eventId}`);
    const etag = first.headers.get('etag');
    assert.equal(first.headers.get('cache-control'), 'public, no-cache');

    assert.equal((await conditionalGet(`/events/${eventId}`, etag)).status, 304);

    const [student] = await ctx.createStudents(1);
    await student.call('POST', `/events/${eventId}/registrations`);
    const after = await conditionalGet(`/events/${eventId}`, etag);
    assert.equal(after.status, 200, 'the server cache was invalidated');
    assert.equal(after.body.event.seatsLeft, 4);
  });

  test('categories are public and include the slug used in filter links', async () => {
    const res = await get('/categories');
    assert.equal(res.status, 200);
    assert.ok(res.body.data.some((category) => category.slug === categorySlug));
  });
});
