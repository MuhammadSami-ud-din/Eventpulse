import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { eventAvailability } from '../src/utils/eventStatus.js';
import { formatEventTime, formatMonth, formatRate, formatShortMonth, formatTicketCode, pluralize } from '../src/utils/format.js';

// Formatting follows the machine's locale, so these tests check structure,
// not exact wording.
describe('formatting', () => {
  test('pluralize picks the singular only for exactly one', () => {
    assert.equal(pluralize(1, 'seat'), '1 seat');
    assert.equal(pluralize(0, 'seat'), '0 seats');
    assert.equal(pluralize(2, 'category', 'categories'), '2 categories');
  });

  test('ticket codes are split in two halves for reading aloud', () => {
    assert.equal(formatTicketCode('ABCDEFGH23'), 'ABCDE FGH23');
  });

  test('rates are whole percentages, and "—" when there is nothing to measure', () => {
    assert.equal(formatRate(0.8), '80%');
    assert.equal(formatRate(2 / 3), '67%');
    assert.equal(formatRate(null), '—');
  });

  test('months never slip into a neighbouring month, whatever the time zone', () => {
    const shortMonth = new Intl.DateTimeFormat(undefined, { month: 'short' });
    assert.equal(formatShortMonth('2026-01'), shortMonth.format(new Date(2026, 0, 15)));
    assert.equal(formatShortMonth('2026-12'), shortMonth.format(new Date(2026, 11, 15)));
    assert.match(formatMonth('2026-11'), /2026/);
  });

  test('a one-day event shows its date once; a multi-day event shows both dates', () => {
    const sameDay = formatEventTime('2026-12-01T09:00:00', '2026-12-01T11:00:00');
    const twoDays = formatEventTime('2026-12-01T09:00:00', '2026-12-02T11:00:00');
    assert.ok(sameDay.includes(' · '));
    assert.ok(!twoDays.includes(' · ') && twoDays.includes(' – '));
  });
});

describe('event availability label', () => {
  const event = (fields) => ({ isPast: false, status: 'published', registrationOpen: true, capacity: 100, seatsLeft: 50, ...fields });

  test('each situation gets its own label', () => {
    assert.equal(eventAvailability(event({ isPast: true })).label, 'Ended');
    assert.equal(eventAvailability(event({ status: 'closed' })).label, 'Registration closed');
    assert.equal(eventAvailability(event({ registrationOpen: false })).label, 'Registration closed');
    assert.equal(eventAvailability(event({ seatsLeft: 0 })).label, 'Full · waitlist open');
    assert.deepEqual(eventAvailability(event({})), { label: 'Open', tone: 'success' });
  });

  test('"only N left" appears at 10% of capacity, or 3 seats for small events', () => {
    assert.equal(eventAvailability(event({ seatsLeft: 10 })).label, 'Only 10 seats left');
    assert.equal(eventAvailability(event({ seatsLeft: 11 })).label, 'Open');
    assert.equal(eventAvailability(event({ capacity: 20, seatsLeft: 3 })).label, 'Only 3 seats left');
    assert.equal(eventAvailability(event({ capacity: 20, seatsLeft: 1 })).label, 'Only 1 seat left');
  });
});
