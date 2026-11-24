import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { suggestPassword } from '../src/utils/password.js';
import { rules } from '../src/utils/validation.js';

describe('suggested passwords', () => {
  test('always meet the password policy and avoid look-alike characters', () => {
    for (let i = 0; i < 500; i += 1) {
      const password = suggestPassword();
      assert.equal(rules.newPassword(password), null, password);
      assert.match(password, /^[a-km-np-zA-HJ-NP-Z2-9]{14}$/);
    }
  });

  test('are different every time', () => {
    const passwords = new Set(Array.from({ length: 100 }, () => suggestPassword()));
    assert.equal(passwords.size, 100);
  });
});
