import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { generateTicketCode, parseTicketInput, toQrPayload } from '../src/utils/ticketCode.js';

describe('ticket codes', () => {
  test('generated codes are 10 characters without look-alikes (0, O, 1, I)', () => {
    for (let i = 0; i < 1000; i += 1) {
      assert.match(generateTicketCode(), /^[A-HJ-NP-Z2-9]{10}$/);
    }
  });

  test('a QR payload parses back to the same code', () => {
    const code = generateTicketCode();
    assert.equal(parseTicketInput(toQrPayload(code)), code);
  });

  test('hand-typed codes are normalised (case, spaces, dashes)', () => {
    assert.equal(parseTicketInput('  abcd-efgh 23 '), 'ABCDEFGH23');
  });

  test('anything that cannot be a ticket is rejected', () => {
    for (const input of ['', 'ABC', 'ABCDEFGH231', 'ABCDEFGH20', 'https://example.com', 'EVENTHUB-TICKET:']) {
      assert.equal(parseTicketInput(input), null, JSON.stringify(input));
    }
  });
});
