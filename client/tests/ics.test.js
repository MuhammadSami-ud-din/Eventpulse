import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { buildIcs, icsFileName } from '../src/utils/ics.js';

const base = {
  uid: 'registration-1@eventhub',
  title: 'Intro to Git',
  startsAt: '2026-11-28T09:00:00.000Z',
  endsAt: '2026-11-28T12:00:00.000Z',
  now: new Date('2026-11-24T10:30:15.123Z'),
};

describe('.ics builder', () => {
  test('produces a valid VEVENT with UTC times and CRLF line endings', () => {
    const ics = buildIcs({ ...base, location: 'CS Lab 3' });
    assert.ok(ics.startsWith('BEGIN:VCALENDAR\r\nVERSION:2.0\r\n'));
    assert.ok(ics.endsWith('END:VCALENDAR\r\n'));
    assert.ok(!/[^\r]\n/.test(ics), 'every newline is preceded by \\r');
    assert.match(ics, /\r\nDTSTART:20261128T090000Z\r\n/);
    assert.match(ics, /\r\nDTEND:20261128T120000Z\r\n/);
    assert.match(ics, /\r\nDTSTAMP:20261124T103015Z\r\n/);
    assert.match(ics, /\r\nLOCATION:CS Lab 3\r\n/);
  });

  test('escapes commas, semicolons, backslashes and newlines in text', () => {
    const ics = buildIcs({ ...base, title: 'Talk; Q&A, part 1', description: 'Line one\nC:\\path' });
    assert.match(ics, /SUMMARY:Talk\; Q&A\\, part 1/);
    assert.match(ics, /DESCRIPTION:Line one\\nC:\\\\path/);
  });

  test('folds long lines at 75 bytes without splitting multi-byte characters', () => {
    const title = 'مشاعرہ '.repeat(20);
    const ics = buildIcs({ ...base, title });
    const encoder = new TextEncoder();
    for (const line of ics.split('\r\n')) {
      assert.ok(encoder.encode(line).length <= 75, `line too long: ${line}`);
    }
    const unfolded = ics.replace(/\r\n /g, '');
    assert.ok(unfolded.includes(`SUMMARY:${title}`), 'unfolding restores the original text');
  });

  test('omits optional fields and makes a safe file name', () => {
    assert.ok(!buildIcs(base).includes('LOCATION'));
    assert.equal(icsFileName('Startup Pitch Night!'), 'startup-pitch-night.ics');
    assert.equal(icsFileName('مشاعرہ'), 'event.ics');
  });
});
