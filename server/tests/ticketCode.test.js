import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { generateTicketCode, parseTicketInput, toQrPayload } from '../src/utils/ticketCode.js';

describe('ticket codes', () => {
  test('generated codes are 10 characters without look-alikes (0, O, 1, I)', () => {
    for (let i = 0; i < 1000; i += 1) {
      assert.match(generateTicketCode(), /^[A-HJ-NP-Z2-9]{10}$/);
    }
  });

  test('QR payload: a link when a base URL is configured, otherwise the bare code', () => {
    const code = generateTicketCode();
    assert.equal(toQrPayload(code), code);
    assert.equal(toQrPayload(code, 'https://eventhub.example.com'), `https://eventhub.example.com/t/${code}`);
  });

  test('both payload formats parse back to the same code', () => {
    const code = generateTicketCode();
    assert.equal(parseTicketInput(toQrPayload(code)), code);
    assert.equal(parseTicketInput(toQrPayload(code, 'https://eventhub.example.com')), code);
  });

  test('ticket links are accepted with any host, trailing slash, query or hash', () => {
    for (const input of [
      'https://eventhub.example.com/t/ABCDEFGH23',
      'http://localhost:5173/t/abcdefgh23/',
      'https://eventhub.example.com/t/ABCDEFGH23?utm=poster#top',
    ]) {
      assert.equal(parseTicketInput(input), 'ABCDEFGH23', input);
    }
  });

  test('hand-typed codes are normalised (case, spaces, dashes)', () => {
    assert.equal(parseTicketInput('  abcd-efgh 23 '), 'ABCDEFGH23');
  });

  test('anything that cannot be a ticket is rejected', () => {
    for (const input of [
      '',
      'ABC',
      'ABCDEFGH231',
      'ABCDEFGH20',
      'https://example.com',
      'https://example.com/t/',
      'https://example.com/t/NOT-A-TICKET-AT-ALL',
      'WIFI:S:CampusNet;T:WPA;P:secret;;',
    ]) {
      assert.equal(parseTicketInput(input), null, JSON.stringify(input));
    }
  });
});
