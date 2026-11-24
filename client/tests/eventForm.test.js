import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { fromLocalInputValue, toLocalInputValue } from '../src/utils/dateInput.js';
import { EVENT_FORM_SCHEMA, toEventFormValues, toEventPayload } from '../src/utils/eventForm.js';
import { validateForm } from '../src/utils/validation.js';

// Runs in the time zone of the machine; the round trip must hold in any zone.
const inDays = (days, hour) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(hour, 0, 0, 0);
  return toLocalInputValue(d);
};

const valid = {
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

  test('numbers must be whole and in range', () => {
    const errors = validateForm({ ...valid, capacity: '2.5', cancellationWindowHours: '-1' }, EVENT_FORM_SCHEMA);
    assert.deepEqual(Object.keys(errors).sort(), ['cancellationWindowHours', 'capacity']);
  });

  test('datetime-local values round-trip through the API format', () => {
    const iso = fromLocalInputValue(valid.startsAt);
    assert.match(iso, /Z$/);
    assert.equal(toLocalInputValue(iso), valid.startsAt);
  });

  test('form values and API payload convert both ways', () => {
    const payload = toEventPayload(valid);
    assert.equal(payload.capacity, 40);
    assert.equal(payload.categoryId, 2);
    const back = toEventFormValues({ ...payload, category: { id: payload.categoryId } });
    assert.deepEqual(back, valid);
  });
});
