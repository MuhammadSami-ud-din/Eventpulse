import { z } from 'zod';
import { optionalText, text } from './common.schemas.js';

// bcrypt silently ignores everything after the 72nd byte, so longer passwords
// would give a false sense of security. Counted in bytes because of UTF-8.
const BCRYPT_MAX_BYTES = 72;

export const email = z.string().trim().toLowerCase().pipe(z.email('Enter a valid email address').max(255));

export const newPassword = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .refine((value) => Buffer.byteLength(value, 'utf8') <= BCRYPT_MAX_BYTES, 'Password is too long')
  .refine((value) => /[a-z]/.test(value) && /[A-Z]/.test(value), 'Use both upper and lower case letters')
  .refine((value) => /\d/.test(value), 'Include at least one number')
  // bcrypt stops reading at a NUL byte, so "Secret@123\0xyz" would really be
  // just "Secret@123". Rejected rather than silently weakened.
  .refine((value) => !value.includes('\u0000'), 'Password contains a character that is not allowed');

// Unknown keys (e.g. a sneaky "role": "admin") are stripped by zod objects.
export const fullName = text({ min: 2, max: 100, tooShort: 'Name is too short' });

export const registerSchema = z.object({
  fullName,
  email,
  password: newPassword,
  department: optionalText({ max: 100 }),
  studentNumber: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9-]{4,20}$/, 'Student number must be 4-20 letters, digits or dashes'),
});

export const loginSchema = z.object({
  email,
  password: z.string().min(1, 'Password is required').max(128),
});

// An empty department means "clear it", so the field itself is required.
export const updateProfileSchema = z.object({
  fullName,
  department: text({ max: 100 }).transform((value) => value || null),
});

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Enter your current password').max(128),
    newPassword,
  })
  .refine((body) => body.currentPassword !== body.newPassword, {
    message: 'Choose a password different from the current one',
    path: ['newPassword'],
  });
