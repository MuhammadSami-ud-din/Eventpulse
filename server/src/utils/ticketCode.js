import { randomInt } from 'node:crypto';

// No 0/O or 1/I, so codes can be read aloud and typed at check-in without mistakes.
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const TICKET_CODE_LENGTH = 10;
const TICKET_CODE_PATTERN = new RegExp(`^[${ALPHABET}]{${TICKET_CODE_LENGTH}}$`);

// The QR holds this prefix plus the code, so the scanner can tell an EventHub
// ticket apart from any other QR code (a URL, a Wi-Fi poster) and say so.
// No signature is needed: codes are random (32^10 possibilities), so a valid
// one cannot be guessed, and check-in is only open to the event's organizer.
const QR_PREFIX = 'EVENTHUB-TICKET:';

export function generateTicketCode() {
  let code = '';
  for (let i = 0; i < TICKET_CODE_LENGTH; i += 1) {
    code += ALPHABET[randomInt(ALPHABET.length)];
  }
  return code;
}

export function toQrPayload(code) {
  return `${QR_PREFIX}${code}`;
}

// Accepts a scanned QR payload or a hand-typed code ("abcd-efgh 23" works).
// Returns the normalised code, or null if it cannot be a ticket code.
export function parseTicketInput(input) {
  const withoutPrefix = input.trim().toUpperCase().replace(QR_PREFIX, '');
  const code = withoutPrefix.replace(/[\s-]/g, '');
  return TICKET_CODE_PATTERN.test(code) ? code : null;
}
