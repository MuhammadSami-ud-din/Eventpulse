// Client-side checks mirror the server's zod rules so mistakes are caught
// before a round trip. The server still validates everything again.

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const STUDENT_NUMBER_PATTERN = /^[A-Za-z0-9-]{4,20}$/;
// bcrypt ignores everything after 72 bytes, so the server rejects longer passwords.
const BCRYPT_MAX_BYTES = 72;

const byteLength = (text) => new TextEncoder().encode(text).length;

// Mirror the server's text() rules: no hidden control characters (line breaks
// and tabs are fine; an <input> cannot hold them anyway) and no text-direction
// overrides, and required text must contain a letter or digit in any script.
const HIDDEN_CHARACTERS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F\u202A-\u202E\u2066-\u2069]/;
const LETTER_OR_DIGIT = /[\p{L}\p{N}]/u;

export const rules = {
  required: (label) => (value) => (String(value ?? '').trim() ? null : `${label} is required`),

  plainText: (label) => (value) => {
    if (HIDDEN_CHARACTERS.test(value)) return `${label} contains hidden control characters`;
    return value.trim() && !LETTER_OR_DIGIT.test(value) ? `${label} must contain letters or digits` : null;
  },

  fullName: (value) => {
    const textError = rules.plainText('Name')(value);
    if (textError) return textError;
    const length = value.trim().length;
    if (length < 2) return 'Name is too short';
    return length > 100 ? 'Name is too long' : null;
  },

  email: (value) => (EMAIL_PATTERN.test(value.trim()) ? null : 'Enter a valid email address'),

  newPassword: (value) => {
    if (value.length < 8) return 'Password must be at least 8 characters';
    if (byteLength(value) > BCRYPT_MAX_BYTES) return 'Password is too long';
    if (!/[a-z]/.test(value) || !/[A-Z]/.test(value)) return 'Use both upper and lower case letters';
    return /\d/.test(value) ? null : 'Include at least one number';
  },

  studentNumber: (value) =>
    STUDENT_NUMBER_PATTERN.test(value.trim()) ? null : 'Student number must be 4-20 letters, digits or dashes',

  maxLength: (max, label) => (value) => (value.trim().length > max ? `${label} must be at most ${max} characters` : null),

  matches: (otherField, message) => (value, values) => (value === values[otherField] ? null : message),

  differsFrom: (otherField, message) => (value, values) => (value !== values[otherField] ? null : message),
};

// `schema` maps a field name to a list of rules; the first failing rule wins.
// Returns { field: message } for every invalid field (empty object = valid).
export function validateForm(values, schema) {
  const errors = {};
  for (const [field, fieldRules] of Object.entries(schema)) {
    for (const rule of fieldRules) {
      const message = rule(values[field] ?? '', values);
      if (message) {
        errors[field] = message;
        break;
      }
    }
  }
  return errors;
}
