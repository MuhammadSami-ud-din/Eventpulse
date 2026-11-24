import { rules } from './validation.js';

// Letters and digits without look-alikes (0/O, 1/l/I), since an admin may
// read the password out or someone may type it from a note.
const ALPHABET = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';

// A random password that meets the server's policy. Drawn again in the rare
// case one misses a required kind of character. (Taking 2^32 random values
// modulo 56 characters favours some by about one part in 77 million: negligible.)
export function suggestPassword(length = 14) {
  for (;;) {
    const values = crypto.getRandomValues(new Uint32Array(length));
    const password = Array.from(values, (value) => ALPHABET[value % ALPHABET.length]).join('');
    if (rules.newPassword(password) === null) return password;
  }
}
