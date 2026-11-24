import { z } from 'zod';
import { slugify } from '../utils/slug.js';
import { email, fullName, newPassword } from './auth.schemas.js';
import { optionalText, paginationFields, text } from './common.schemas.js';

const role = z.enum(['student', 'organizer', 'admin']);

export const listUsersQuerySchema = z.object({
  q: z.string().trim().max(100).optional(),
  role: role.optional(),
  ...paginationFields,
  pageSize: paginationFields.pageSize.default(25),
});

// Students sign up themselves (they need a student number), so admins only
// create organizer and admin accounts.
export const createAccountSchema = z.object({
  fullName,
  email,
  password: newPassword,
  department: optionalText({ max: 100 }),
  role: z.enum(['organizer', 'admin']),
});

export const changeRoleSchema = z.object({ role });

export const changeStatusSchema = z.object({ isActive: z.boolean() });

export const categorySchema = z.object({
  name: text({ min: 2, max: 50, tooShort: 'Name is too short' }).refine(
    (name) => slugify(name) !== '',
    'Use at least one letter or digit (A-Z, 0-9)',
  ),
  description: optionalText({ max: 255 }),
});
