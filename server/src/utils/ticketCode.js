import { randomInt } from 'node:crypto';

// No 0/O or 1/I, so codes can be read aloud and typed at check-in without mistakes.
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const TICKET_CODE_LENGTH = 10;
const TICKET_CODE_PATTERN = new RegExp(`^[${ALPHABET}]{${TICKET_CODE_LENGTH}}$`);
// The last path segment after "/t/" in a ticket link, ignoring ?query and #hash.
const TICKET_LINK_PATTERN = /\/t\/([^/?#]+)\/?(?:[?#].*)?$/;

export function generateTicketCode() {
  let code = '';
  for (let i = 0; i < TICKET_CODE_LENGTH; i += 1) {
    code += ALPHABET[randomInt(ALPHABET.length)];
  }
  return code;
}

// What the QR code contains. With a base URL it is a link, so a student who
// scans their own ticket with a phone camera lands on its status page; without
// one it is just the code. Either way it carries no signature: codes are random
// (32^10 possibilities) and only the event's organizer can check people in.
export function toQrPayload(code, baseUrl = '') {
  return baseUrl ? `${baseUrl}/t/${code}` : code;
}

// Accepts a scanned link (any host: the code is what gets looked up), a
// scanned bare code, or a hand-typed code such as "abcd-efgh 23".
// Returns the normalised code, or null if the input cannot be a ticket.
export function parseTicketInput(input) {
  const trimmed = input.trim();
  const raw = trimmed.match(TICKET_LINK_PATTERN)?.[1] ?? trimmed;
  const code = raw.toUpperCase().replace(/[\s-]/g, '');
  return TICKET_CODE_PATTERN.test(code) ? code : null;
}
