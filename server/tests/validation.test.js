import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { days, fromNow, hours, TestContext } from './helpers.js';

const ctx = new TestContext();
let admin;
let student;
let eventId;
before(async () => {
  await ctx.start();
  admin = await ctx.createUser('admin');
  student = await ctx.createUser('student');
  eventId = await ctx.createEvent();
});
after(() => ctx.cleanup());

function validEvent(overrides = {}) {
  const startsAt = fromNow(days(10));
  return {
    title: 'Validation test event',
    description: 'Created by the validation tests.',
    venue: 'Test Lab',
    categoryId: ctx.categoryIds[0],
    startsAt: startsAt.toISOString(),
    endsAt: new Date(startsAt.getTime() + hours(2)).toISOString(),
    registrationDeadline: new Date(startsAt.getTime() - hours(2)).toISOString(),
    capacity: 10,
    cancellationWindowHours: 24,
    ...overrides,
  };
}

// Creates an event through the API and remembers it for cleanup.
async function postEvent(overrides) {
  const res = await ctx.organizer.call('POST', '/organizer/events', validEvent(overrides));
  if (res.status === 201) ctx.eventIds.push(res.body.event.id);
  return res;
}

const fieldsOf = (res) => res.body.error?.details?.map((detail) => detail.field) ?? [];

function assertRejected(res, field, label = field) {
  assert.equal(res.status, 400, `${label}: expected 400, got ${res.status}`);
  assert.equal(res.body.error.code, 'VALIDATION_ERROR', label);
  if (field !== undefined) assert.ok(fieldsOf(res).includes(field), `${label}: no error on "${field}" (got ${fieldsOf(res)})`);
}

describe('request bodies', () => {
  test('a body over 100 KB gets a 413 JSON error, not a 500', async () => {
    const res = await student.call.raw('PATCH', '/auth/me', JSON.stringify({ fullName: 'x'.repeat(200 * 1024) }));
    assert.equal(res.status, 413);
    assert.equal(res.body.error.code, 'PAYLOAD_TOO_LARGE');
  });

  test('malformed JSON is a 400 INVALID_JSON', async () => {
    const res = await student.call.raw('PATCH', '/auth/me', '{"fullName": "unterminated');
    assert.equal(res.status, 400);
    assert.equal(res.body.error.code, 'INVALID_JSON');
  });

  test('a body that is not JSON is a 415, not a misleading "required" error', async () => {
    for (const [body, type] of [
      ['fullName=Someone', 'application/x-www-form-urlencoded'],
      ['fullName: Someone', 'text/plain'],
    ]) {
      const res = await student.call.raw('PATCH', '/auth/me', body, type);
      assert.equal(res.status, 415, type);
      assert.equal(res.body.error.code, 'UNSUPPORTED_MEDIA_TYPE', type);
    }
  });

  test('JSON that is not an object is rejected', async () => {
    for (const body of ['[]', '[{"fullName":"Someone"}]', 'null']) {
      const res = await student.call.raw('PATCH', '/auth/me', body);
      assert.equal(res.status, 400, body);
    }
  });

  test('unknown fields are ignored, never applied', async () => {
    const res = await student.call('PATCH', '/auth/me', { fullName: 'Still Student', department: '', role: 'admin', isActive: false });
    assert.equal(res.status, 200);
    assert.equal(res.body.user.role, 'student');
    assert.equal(res.body.user.isActive, true);
  });
});

describe('numbers', () => {
  test('ids in the URL must be plain positive whole numbers', async () => {
    for (const id of ['0', '-1', '1.5', '1e3', '0x10', '007', '%207', 'abc', '99999999999']) {
      assertRejected(await student.call('GET', `/events/${id}`), 'id', `id ${id}`);
    }
    assert.equal((await student.call('GET', `/events/${eventId}`)).status, 200);
  });

  test('query numbers: no exponents, blanks or repeated parameters', async () => {
    for (const query of ['page=1e2', 'page=', 'page=1&page=2', 'pageSize=51', 'page=2.5']) {
      assertRejected(await student.call('GET', `/events?${query}`), undefined, query);
    }
    assert.equal((await student.call('GET', '/events?page=1&pageSize=5')).status, 200);
  });

  test('JSON numbers must be real numbers, not strings, booleans or arrays', async () => {
    for (const capacity of ['10', true, [10], '0x10', null, 10.5]) {
      assertRejected(await postEvent({ capacity }), 'capacity', `capacity ${JSON.stringify(capacity)}`);
    }
    const huge = await ctx.organizer.call.raw('POST', '/organizer/events', JSON.stringify(validEvent()).replace('"capacity":10', '"capacity":1e400'));
    assertRejected(huge, 'capacity', 'capacity 1e400 (Infinity)');
    assert.equal((await postEvent()).status, 201);
  });
});

describe('text', () => {
  const setName = (fullName) => student.call('PATCH', '/auth/me', { fullName, department: '' });

  test('line breaks, control characters and text-direction overrides are rejected in names', async () => {
    for (const fullName of ['Ali\nHassan', 'Ali\u0000Hassan', 'Ali\u0007', '‮nassaH ilA', 'Ali⁦Hassan']) {
      assertRejected(await setName(fullName), 'fullName', JSON.stringify(fullName));
    }
  });

  test('a name must contain letters or digits, not just invisible characters', async () => {
    assertRejected(await setName('​​​'), 'fullName', 'zero-width spaces');
    assertRejected(await setName('—…—'), 'fullName', 'punctuation only');
    assert.equal((await setName('Ali')).status, 200);
  });

  test('text is stored in one Unicode form, so "é" typed two ways is the same', async () => {
    const res = await setName('Zoé Mirza');
    assert.equal(res.body.user.fullName, 'Zoé Mirza');
  });

  test('names in other scripts are accepted', async () => {
    for (const fullName of ['علی حسن', 'Ayşe Yılmaz', '王小明']) {
      assert.equal((await setName(fullName)).status, 200, fullName);
    }
  });

  test('descriptions keep line breaks and tabs but reject other control characters', async () => {
    assert.equal((await postEvent({ description: 'Line one\nLine two\n\tIndented' })).status, 201);
    assertRejected(await postEvent({ description: 'Hidden\u0000byte in the text' }), 'description');
  });

  test('a new password cannot contain a NUL byte (bcrypt would ignore everything after it)', async () => {
    // A failed login still leaves the session with a CSRF cookie to sign up with.
    const session = await ctx.login(`nobody-${ctx.runId}@eventhub.test`, 'x');
    const res = await session.call('POST', '/auth/register', {
      fullName: 'Nul Byte',
      email: `nul-${ctx.runId}@eventhub.test`,
      studentNumber: `N${ctx.runId}`.slice(0, 20),
      password: 'Secret@123\u0000anything',
    });
    assertRejected(res, 'password');
  });
});

describe('dates', () => {
  test('events start at most 2 years ahead and last at most 14 days', async () => {
    const farStart = fromNow(days(800));
    assertRejected(
      await postEvent({
        startsAt: farStart.toISOString(),
        endsAt: new Date(farStart.getTime() + hours(2)).toISOString(),
        registrationDeadline: farStart.toISOString(),
      }),
      'startsAt',
    );
    assertRejected(await postEvent({ endsAt: fromNow(days(30)).toISOString() }), 'endsAt');
  });

  test('dates outside 2000-2100 are rejected everywhere', async () => {
    assertRejected(await student.call('GET', '/events?from=1000-01-01T00:00:00Z'), 'from');
    assertRejected(await student.call('GET', '/events?to=9999-12-31T00:00:00Z'), 'to');
  });

  test('a date without a time zone is rejected, so it is never guessed', async () => {
    assertRejected(await postEvent({ startsAt: '2027-01-10T10:00:00' }), 'startsAt');
  });
});

// Every route, every hostile input: the API may refuse, but must never crash.
describe('no route answers hostile input with a server error', () => {
  const HOSTILE_IDS = ['abc', '-1', '99999999999999999999', '%00', '1;DROP TABLE users', '..%2F..'];
  const HOSTILE_BODIES = [
    '{}',
    '[]',
    '"just a string"',
    '{"id":{"$gt":0},"status":["x"],"code":{"a":1},"role":[],"isActive":"yes"}',
    `{"title":"${'x'.repeat(20000)}","reason":"${'y'.repeat(20000)}","name":"${'z'.repeat(20000)}"}`,
    '{"__proto__":{"isAdmin":true},"constructor":{"prototype":{"x":1}}}',
    '{"capacity":1e400,"categoryId":-1,"page":0}',
  ];
  const ROUTES = [
    ['GET', '/events/:id'],
    ['POST', '/events/:id/registrations'],
    ['GET', '/me/registrations/:id'],
    ['GET', '/me/registrations/:id/qr'],
    ['POST', '/me/registrations/:id/cancel'],
    ['POST', '/notifications/:id/read'],
    ['GET', '/tickets/:id'],
    ['GET', '/organizer/events/:id'],
    ['PATCH', '/organizer/events/:id'],
    ['DELETE', '/organizer/events/:id'],
    ['POST', '/organizer/events/:id/publish'],
    ['POST', '/organizer/events/:id/close'],
    ['GET', '/organizer/events/:id/stats'],
    ['GET', '/organizer/events/:id/registrations'],
    ['GET', '/organizer/events/:id/registrations/export'],
    ['POST', '/organizer/events/:id/check-in'],
    ['PUT', '/organizer/events/:id/registrations/:id/attendance'],
    ['POST', '/organizer/events/:id/attendance/no-shows'],
    ['POST', '/admin/events/:id/approve'],
    ['POST', '/admin/events/:id/reject'],
    ['PUT', '/admin/users/:id/role'],
    ['PUT', '/admin/users/:id/status'],
    ['PUT', '/admin/categories/:id'],
    ['DELETE', '/admin/categories/:id'],
    ['GET', '/images/avatars/:id'],
    ['GET', '/images/covers/:id'],
    ['PUT', '/organizer/events/:id/cover'],
    ['DELETE', '/organizer/events/:id/cover'],
  ];
  const BODY_ROUTES = [
    ['POST', '/auth/login'],
    ['POST', '/auth/register'],
    ['PATCH', '/auth/me'],
    ['POST', '/auth/password'],
    ['POST', '/organizer/events'],
    ['PATCH', `/organizer/events/{event}`],
    ['POST', `/organizer/events/{event}/check-in`],
    ['POST', '/admin/users'],
    ['POST', '/admin/categories'],
    ['POST', `/admin/events/{event}/reject`],
    ['PUT', '/account/avatar'],
  ];
  const QUERY_ROUTES = ['/events', '/me/registrations', '/notifications', '/organizer/events', '/admin/users', '/admin/analytics', `/organizer/events/{event}/stats`];
  const HOSTILE_QUERIES = ['page=-1', 'pageSize=1000000', 'sort=__proto__', 'status[]=x', 'q=%00%27%22', `q=${'x'.repeat(5000)}`, 'from=not-a-date', 'utcOffsetMinutes=1e9', 'scope=everything', 'eventId=0x1'];

  // Admins may call every route; students cover their own /me routes.
  const clientFor = (path) => (path.startsWith('/me') || path.startsWith('/events') ? student : admin);
  const fill = (path) => path.replaceAll('{event}', String(eventId));

  test('hostile ids', async () => {
    for (const [method, template] of ROUTES) {
      for (const id of HOSTILE_IDS) {
        const path = template.replaceAll(':id', id);
        const res = await clientFor(path).call.raw(method, path, '{}');
        assert.ok(res.status < 500, `${method} ${path} -> ${res.status}`);
      }
    }
  });

  test('hostile bodies', async () => {
    for (const [method, template] of [...BODY_ROUTES, ...ROUTES.map(([m, p]) => [m, p.replaceAll(':id', String(eventId))])]) {
      const path = fill(template);
      for (const body of HOSTILE_BODIES) {
        const res = await clientFor(path).call.raw(method, path, body);
        assert.ok(res.status < 500, `${method} ${path} ${body.slice(0, 40)} -> ${res.status}`);
      }
    }
  });

  test('hostile query strings', async () => {
    for (const template of QUERY_ROUTES) {
      const path = fill(template);
      for (const query of HOSTILE_QUERIES) {
        const res = await clientFor(path).call('GET', `${path}?${query}`);
        assert.ok(res.status < 500, `GET ${path}?${query.slice(0, 40)} -> ${res.status}`);
      }
    }
  });
});
