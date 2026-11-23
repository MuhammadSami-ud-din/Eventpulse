import { randomInt } from 'node:crypto';

// No 0/O or 1/I, so codes can be read aloud and typed at check-in without mistakes.
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const TICKET_CODE_LENGTH = 10;

export function generateTicketCode() {
  let code = '';
  for (let i = 0; i < TICKET_CODE_LENGTH; i += 1) {
    code += ALPHABET[randomInt(ALPHABET.length)];
  }
  return code;
}
