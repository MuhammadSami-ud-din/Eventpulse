import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { fromLocalInputValue, toLocalInputValue } from '../src/utils/dateInput.js';
import { EMPTY_EVENT_FORM, EVENT_FORM_SCHEMA, parseTags, toEventFormValues, toEventPayload } from '../src/utils/eventForm.js';
import { validateForm } from '../src/utils/validation.js';

// Runs in the time zone of the machine; the round trip must hold in any zone.
const inDays = (days, hour) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(hour, 0, 0, 0);
  return toLocalInputValue(d);
};

const valid = {
  ...EMPTY_EVENT_FORM,
  title: 'Docker 101',
  categoryId: '2',
  venue: 'CS Lab 2',
  description: 'Containers from scratch.',
  startsAt: inDays(10, 14),
  endsAt: inDays(10, 16),
  registrationDeadline: inDays(9, 12),
  capacity: '40',
  cancellationWindowHours: '24',
};

describe('event form', () => {
  test('a valid event passes', () => {
    assert.deepEqual(validateForm(valid, EVENT_FORM_SCHEMA), {});
  });

  test('schedule rules match the server', () => {
    const errors = validateForm(
      { ...valid, startsAt: inDays(-1, 10), endsAt: inDays(-2, 10), registrationDeadline: inDays(1, 10) },
      EVENT_FORM_SCHEMA,
    );
    assert.deepEqual(Object.keys(errors).sort(), ['endsAt', 'registrationDeadline', 'startsAt']);
  });

  test('limits match the server: at most 2 years ahead, at most 14 days long', () => {
    let errors = validateForm({ ...valid, startsAt: inDays(800, 10), endsAt: inDays(800, 12), registrationDeadline: inDays(799, 10) }, EVENT_FORM_SCHEMA);
    assert.match(errors.startsAt, /2 years/);
    errors = validateForm({ ...valid, endsAt: inDays(30, 10) }, EVENT_FORM_SCHEMA);
    assert.match(errors.endsAt, /14 days/);
  });

  test('numbers must be whole and in range', () => {
    const errors = validateForm({ ...valid, capacity: '2.5', cancellationWindowHours: '-1' }, EVENT_FORM_SCHEMA);
    assert.deepEqual(Object.keys(errors).sort(), ['cancellationWindowHours', 'capacity']);
  });

  test('datetime-local values round-trip through the API format', () => {
    const iso = fromLocalInputValue(valid.startsAt);
    assert.match(iso, /Z$/);
    assert.equal(toLocalInputValue(iso), valid.startsAt);
  });

  test('details: list problems name the item; tags are checked like the server', () => {
    const errors = validateForm(
      {
        ...valid,
        agenda: [{ time: '09:00', title: 'Welcome', details: '' }, { time: '', title: 'Talk', details: '' }],
        speakers: [{ name: 'X', role: '' }],
        tags: 'AI, ai',
        tagline: 'x'.repeat(161),
      },
      EVENT_FORM_SCHEMA,
    );
    assert.equal(errors.agenda, 'Agenda item 2: add a time');
    assert.match(errors.speakers, /^Speaker 1: The name must be at least 2 characters/);
    assert.equal(errors.tags, 'Each tag only once');
    assert.match(errors.tagline, /at most 160/);
    assert.match(validateForm({ ...valid, tags: '#hashtag' }, EVENT_FORM_SCHEMA).tags, /letters, digits/);
    assert.deepEqual(parseTags(' AI ,, Teams , '), ['AI', 'Teams']);
  });

  test('form values and API payload convert both ways', () => {
    const payload = toEventPayload(valid);
    assert.equal(payload.capacity, 40);
    assert.equal(payload.categoryId, 2);
    const back = toEventFormValues({ ...payload, category: { id: payload.categoryId } });
    assert.deepEqual(back, valid);
  });

  test('details convert both ways; empty optional parts are left out of the payload', () => {
    const withDetails = {
      ...valid,
      tagline: ' Learn containers ',
      agenda: [{ time: '14:00', title: 'Intro', details: '' }, { time: '15:00', title: 'Lab', details: 'Bring a laptop' }],
      speakers: [{ name: 'Ayesha Khan', role: '' }],
      tags: 'docker, devops',
    };
    const payload = toEventPayload(withDetails);
    assert.equal(payload.tagline, 'Learn containers');
    assert.deepEqual(payload.agenda, [{ time: '14:00', title: 'Intro' }, { time: '15:00', title: 'Lab', details: 'Bring a laptop' }]);
    assert.deepEqual(payload.speakers, [{ name: 'Ayesha Khan' }]);
    assert.deepEqual(payload.tags, ['docker', 'devops']);
    const back = toEventFormValues({ ...payload, category: { id: payload.categoryId } });
    assert.deepEqual(back, { ...withDetails, tagline: 'Learn containers', tags: 'docker, devops' });
  });
});
