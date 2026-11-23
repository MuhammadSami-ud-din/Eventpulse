import { z } from 'zod';

// bcrypt silently ignores everything after the 72nd byte, so longer passwords
// would give a false sense of security. Counted in bytes because of UTF-8.
const BCRYPT_MAX_BYTES = 72;

const email = z.string().trim().toLowerCase().pipe(z.email('Enter a valid email address').max(255));

const newPassword = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .refine((value) => Buffer.byteLength(value, 'utf8') <= BCRYPT_MAX_BYTES, 'Password is too long')
  .refine((value) => /[a-z]/.test(value) && /[A-Z]/.test(value), 'Use both upper and lower case letters')
  .refine((value) => /\d/.test(value), 'Include at least one number');

// Unknown keys (e.g. a sneaky "role": "admin") are stripped by zod objects.
export const registerSchema = z.object({
  fullName: z.string().trim().min(2, 'Name is too short').max(100),
  email,
  password: newPassword,
  department: z.string().trim().max(100).optional(),
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
