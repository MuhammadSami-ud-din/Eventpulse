import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { pool } from '../src/db/pool.js';
import { days, fromNow, hours, TestContext } from './helpers.js';

const ctx = new TestContext();
before(() => ctx.start());
after(() => ctx.cleanup());

const DETAILS = {
  tagline: 'Build something real in 24 hours',
  agenda: [
    { time: '09:00', title: 'Doors open and breakfast' },
    { time: '10:00', title: 'Kick-off talk', details: 'Rules, themes and teams.' },
  ],
  speakers: [{ name: 'Dr. Sara Malik', role: 'Head of CS' }, { name: 'Computing Society' }],
  tags: ['coding', 'Teams', 'AI-ML'],
  whatToBring: 'A laptop and its charger.\nA reusable water bottle.',
  entryNotes: 'Smart casual. Bring your student card.',
  contact: 'computing.society@eventhub.test',
};

function eventFields(overrides = {}) {
  const startsAt = fromNow(days(12));
  return {
    title: `Details event ${ctx.runId}`,
    description: 'An event with every optional detail filled in.',
    venue: 'Innovation Center',
    categoryId: ctx.categoryIds[0],
    startsAt: startsAt.toISOString(),
    endsAt: new Date(startsAt.getTime() + hours(8)).toISOString(),
    registrationDeadline: new Date(startsAt.getTime() - hours(2)).toISOString(),
    capacity: 30,
    ...overrides,
  };
}

async function create(overrides) {
  const res = await ctx.organizer.call('POST', '/organizer/events', eventFields(overrides));
  if (res.status === 201) ctx.eventIds.push(res.body.event.id);
  return res;
}

const fieldsOf = (res) => res.body.error?.details?.map((detail) => detail.field) ?? [];

describe('event details', () => {
  test('an event keeps its tagline, agenda, speakers, tags and notes, and shows them publicly', async () => {
    const res = await create(DETAILS);
    assert.equal(res.status, 201, JSON.stringify(res.body));
    const { event } = res.body;
    assert.equal(event.tagline, DETAILS.tagline);
    assert.deepEqual(event.agenda, [{ time: '09:00', title: 'Doors open and breakfast' }, DETAILS.agenda[1]]);
    assert.deepEqual(event.speakers, DETAILS.speakers);
    assert.deepEqual(event.tags, DETAILS.tags);
    assert.equal(event.whatToBring, DETAILS.whatToBring, 'line breaks are kept');

    await pool.query("UPDATE events SET status = 'published' WHERE id = ?", [event.id]);
    const publicEvent = (await (await fetch(`${ctx.baseUrl}/events/${event.id}`)).json()).event;
    assert.equal(publicEvent.contact, DETAILS.contact);
    assert.deepEqual(publicEvent.agenda.map((item) => item.time), ['09:00', '10:00']);
  });

  test('details are optional: events without them return empty lists and nulls', async () => {
    const eventId = await ctx.createEvent();
    const { event } = (await ctx.organizer.call('GET', `/organizer/events/${eventId}`)).body;
    assert.deepEqual([event.agenda, event.speakers, event.tags], [[], [], []]);
    assert.equal(event.tagline, null);
  });

  test('an edit can clear a text detail ("") and replaces a list as a whole', async () => {
    const { event } = (await create(DETAILS)).body;

    const res = await ctx.organizer.call('PATCH', `/organizer/events/${event.id}`, {
      tagline: '',
      agenda: [{ time: '18:30', title: 'Only item' }],
      tags: [],
    });

    assert.equal(res.status, 200);
    assert.equal(res.body.event.tagline, null);
    assert.deepEqual(res.body.event.agenda, [{ time: '18:30', title: 'Only item' }]);
    assert.deepEqual(res.body.event.tags, []);
    assert.deepEqual(res.body.event.speakers, DETAILS.speakers, 'fields not sent are untouched');
  });

  test('every detail is validated, down to each list item', async () => {
    const cases = [
      [{ agenda: [{ time: '25:00', title: 'Late' }] }, 'agenda.0.time'],
      [{ agenda: [{ time: '9:00', title: 'Single-digit hour' }] }, 'agenda.0.time'],
      [{ agenda: Array.from({ length: 21 }, () => ({ time: '10:00', title: 'Item' })) }, 'agenda'],
      [{ speakers: [{ name: '‮noitpo' }] }, 'speakers.0.name'],
      [{ tags: ['AI', 'ai'] }, 'tags'],
      [{ tags: ['#hashtag'] }, 'tags.0'],
      [{ tagline: 'x'.repeat(161) }, 'tagline'],
      [{ contact: 'line\nbreak' }, 'contact'],
      [{ agenda: 'not a list' }, 'agenda'],
    ];
    for (const [overrides, field] of cases) {
      const res = await create(overrides);
      assert.equal(res.status, 400, `${JSON.stringify(overrides).slice(0, 60)} -> ${res.status}`);
      assert.ok(fieldsOf(res).includes(field), `expected an error on ${field}, got ${fieldsOf(res)}`);
    }
  });

  test('unknown keys inside list items are dropped', async () => {
    const res = await create({ agenda: [{ time: '10:00', title: 'Talk', onclick: 'alert(1)' }] });
    assert.deepEqual(res.body.event.agenda, [{ time: '10:00', title: 'Talk' }]);
  });

  test('HTML in text is stored and returned as plain text inside JSON, never as markup', async () => {
    const description = 'Hello <script>alert(1)</script> and <img src=x onerror=alert(2)> **bold**';
    const res = await create({ description, tagline: '<b>not bold</b>' });

    assert.equal(res.status, 201);
    assert.equal(res.body.event.description, description, 'kept exactly as typed; the client renders it safely');
    const read = await ctx.organizer.call('GET', `/organizer/events/${res.body.event.id}`);
    assert.match(read.headers.get('content-type'), /^application\/json/, 'never served as HTML');
    assert.equal(read.body.event.tagline, '<b>not bold</b>');
  });
});
