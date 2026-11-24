import { z } from 'zod';
import { isoDateTime, paginationFields } from './common.schemas.js';

const EVENT_STATUSES = ['draft', 'pending', 'published', 'rejected', 'closed'];

const eventFields = {
  title: z.string().trim().min(3, 'Title is too short').max(150),
  description: z.string().trim().min(10, 'Add a longer description').max(5000),
  venue: z.string().trim().min(2, 'Venue is required').max(150),
  categoryId: z.coerce.number().int().positive('Choose a category'),
  startsAt: isoDateTime,
  endsAt: isoDateTime,
  registrationDeadline: isoDateTime,
  cancellationWindowHours: z.coerce.number().int().min(0).max(720),
  capacity: z.coerce.number().int().min(1, 'Capacity must be at least 1').max(100000),
};

// Shared by create (on the request body) and update (on the merged event),
// so both enforce exactly the same rules. Returns validation-error details.
export function scheduleIssues({ startsAt, endsAt, registrationDeadline }, now = Date.now()) {
  const issues = [];
  if (startsAt.getTime() <= now) {
    issues.push({ field: 'startsAt', message: 'Start time must be in the future' });
  }
  if (endsAt <= startsAt) {
    issues.push({ field: 'endsAt', message: 'End time must be after the start time' });
  }
  if (registrationDeadline > startsAt) {
    issues.push({ field: 'registrationDeadline', message: 'Registration must close before the event starts' });
  }
  return issues;
}

export const createEventSchema = z
  .object({ ...eventFields, cancellationWindowHours: eventFields.cancellationWindowHours.default(24) })
  .superRefine((event, ctx) => {
    for (const issue of scheduleIssues(event)) {
      ctx.addIssue({ code: 'custom', path: [issue.field], message: issue.message });
    }
  });

export const updateEventSchema = z
  .object(eventFields)
  .partial()
  .refine((patch) => Object.keys(patch).length > 0, 'Send at least one field to update');

export const listEventsQuerySchema = z
  .object({
    q: z.string().trim().max(100).optional(),
    category: z.string().trim().regex(/^[a-z0-9-]{1,60}$/, 'Invalid category').optional(),
    from: isoDateTime.optional(),
    to: isoDateTime.optional(),
    sort: z.enum(['date', 'date_desc', 'newest', 'popular']).default('date'),
    ...paginationFields,
  })
  .refine((query) => !query.from || !query.to || query.from <= query.to, {
    message: '"from" must be before "to"',
    path: ['to'],
  });

export const managedEventsQuerySchema = z.object({
  q: z.string().trim().max(100).optional(),
  status: z.enum(EVENT_STATUSES).optional(),
  sort: z.enum(['date', 'date_desc', 'newest', 'popular']).default('date_desc'),
  ...paginationFields,
});

export const rejectEventSchema = z.object({
  reason: z.string().trim().min(5, 'Give the organizer a short reason').max(255),
});

export const eventStatsQuerySchema = z.object({
  // The browser's offset from UTC in minutes (east positive), from -12h to +14h.
  utcOffsetMinutes: z.coerce.number().int().min(-720).max(840).default(0),
});
