import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { rules, validateForm } from '../src/utils/validation.js';

describe('form validation', () => {
  test('password rules match the server policy', () => {
    assert.equal(rules.newPassword('Passw0rd'), null);
    assert.match(rules.newPassword('Pa1'), /at least 8/);
    assert.match(rules.newPassword('password1'), /upper and lower/);
    assert.match(rules.newPassword('Password'), /number/);
    // 4-byte emoji: 19 of them is 76 bytes, over bcrypt's 72-byte limit.
    assert.match(rules.newPassword(`Aa1${'😀'.repeat(19)}`), /too long/);
  });

  test('validateForm reports the first failing rule per field', () => {
    const schema = {
      email: [rules.required('Email'), rules.email],
      password: [rules.newPassword],
      confirm: [rules.matches('password', 'Passwords do not match')],
    };
    assert.deepEqual(validateForm({ email: '', password: 'Passw0rd', confirm: 'x' }, schema), {
      email: 'Email is required',
      confirm: 'Passwords do not match',
    });
    assert.deepEqual(validateForm({ email: 'a@b.co', password: 'Passw0rd', confirm: 'Passw0rd' }, schema), {});
  });

  test('student number and name limits', () => {
    assert.equal(rules.studentNumber('eh-410001'), null);
    assert.ok(rules.studentNumber('ab'));
    assert.ok(rules.studentNumber('has space'));
    assert.ok(rules.fullName(' A '));
    assert.equal(rules.fullName('Ayesha Khan'), null);
  });

  test('text must be visible: no hidden control characters, and some letters or digits', () => {
    const rule = rules.plainText('Name');
    assert.equal(rule('Ali Hassan'), null);
    assert.equal(rule('علی حسن'), null, 'any script');
    assert.equal(rule(''), null, 'emptiness is left to the "required" rule');
    assert.equal(rule('Line one\nLine two'), null, 'line breaks are fine in long text');
    assert.match(rule('\u202Enoitpo'), /hidden control characters/);
    assert.match(rule('Ali\u0000'), /hidden control characters/);
    assert.match(rule('\u200B\u200B\u200B'), /letters or digits/);
    assert.match(rules.fullName('—…—'), /letters or digits/);
  });
});
