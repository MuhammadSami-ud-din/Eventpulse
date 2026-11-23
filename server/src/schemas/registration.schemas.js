import { z } from 'zod';
import { paginationFields } from './common.schemas.js';

const REGISTRATION_STATUSES = ['confirmed', 'waitlisted', 'cancelled'];

export const myRegistrationsQuerySchema = z.object({
  eventId: z.coerce.number().int().positive().optional(),
  scope: z.enum(['upcoming', 'past', 'all']).default('all'),
  status: z.enum(REGISTRATION_STATUSES).optional(),
});

export const eventRegistrationsQuerySchema = z.object({
  q: z.string().trim().max(100).optional(),
  status: z.enum(REGISTRATION_STATUSES).optional(),
  ...paginationFields,
  pageSize: paginationFields.pageSize.default(25),
});
