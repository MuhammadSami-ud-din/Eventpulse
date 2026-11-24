import { z } from 'zod';
import { id, isoDateTime, optionalText, paginationFields, text, wholeNumber } from './common.schemas.js';

const EVENT_STATUSES = ['draft', 'pending', 'published', 'rejected', 'closed'];

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
// Limits that keep obvious typos (year 2062 instead of 2026, an end date a
// month late) from becoming real events.
const MAX_DAYS_AHEAD = 2 * 365;
const MAX_DURATION_DAYS = 14;

export const EVENT_DETAIL_LIMITS = { agendaItems: 20, speakers: 12, tags: 8 };

const agendaItem = z.object({
  time: z.string({ error: 'Add a time' }).regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use 24-hour time, e.g. 14:30'),
  title: text({ min: 2, max: 120, tooShort: 'Add a title' }),
  details: optionalText({ max: 300 }),
});

const speaker = z.object({
  name: text({ min: 2, max: 100, tooShort: 'Add a name' }),
  role: optionalText({ max: 100 }),
});

// A short label: letters (any script), digits, spaces and hyphens.
const tag = text({ min: 2, max: 30, tooShort: 'Tags need at least 2 characters' }).refine(
  (value) => /^[\p{L}\p{N}][\p{L}\p{N} -]*$/u.test(value),
  'Tags can use letters, digits, spaces and hyphens',
);

const tagList = z
  .array(tag)
  .max(EVENT_DETAIL_LIMITS.tags, `At most ${EVENT_DETAIL_LIMITS.tags} tags`)
  .refine((tags) => new Set(tags.map((value) => value.toLowerCase())).size === tags.length, 'Each tag only once');

const eventFields = {
  title: text({ min: 3, max: 150, tooShort: 'Title is too short' }),
  description: text({ min: 10, max: 5000, multiline: true, tooShort: 'Add a longer description' }),
  venue: text({ min: 2, max: 150, tooShort: 'Venue is required' }),
  categoryId: id,
  startsAt: isoDateTime,
  endsAt: isoDateTime,
  registrationDeadline: isoDateTime,
  cancellationWindowHours: wholeNumber({ min: 0, max: 720 }),
  capacity: wholeNumber({ min: 1, max: 100000 }),
  // Optional details for the event page. An empty string clears a text field.
  tagline: optionalText({ max: 160 }),
  agenda: z.array(agendaItem).max(EVENT_DETAIL_LIMITS.agendaItems, `At most ${EVENT_DETAIL_LIMITS.agendaItems} agenda items`),
  speakers: z.array(speaker).max(EVENT_DETAIL_LIMITS.speakers, `At most ${EVENT_DETAIL_LIMITS.speakers} speakers or hosts`),
  tags: tagList,
  whatToBring: optionalText({ max: 500, multiline: true }),
  entryNotes: optionalText({ max: 500, multiline: true }),
  contact: optionalText({ max: 255 }),
};

// Shared by create (on the request body) and update (on the merged event),
// so both enforce exactly the same rules. Returns validation-error details.
export function scheduleIssues({ startsAt, endsAt, registrationDeadline }, now = Date.now()) {
  const issues = [];
  if (startsAt.getTime() <= now) {
    issues.push({ field: 'startsAt', message: 'Start time must be in the future' });
  } else if (startsAt.getTime() > now + MAX_DAYS_AHEAD * DAY_MS) {
    issues.push({ field: 'startsAt', message: 'Events can be scheduled at most 2 years ahead' });
  }
  if (endsAt <= startsAt) {
    issues.push({ field: 'endsAt', message: 'End time must be after the start time' });
  } else if (endsAt - startsAt > MAX_DURATION_DAYS * DAY_MS) {
    issues.push({ field: 'endsAt', message: `An event can last at most ${MAX_DURATION_DAYS} days` });
  }
  if (registrationDeadline > startsAt) {
    issues.push({ field: 'registrationDeadline', message: 'Registration must close before the event starts' });
  }
  return issues;
}

export const createEventSchema = z
  .object({
    ...eventFields,
    cancellationWindowHours: eventFields.cancellationWindowHours.default(24),
    agenda: eventFields.agenda.default([]),
    speakers: eventFields.speakers.default([]),
    tags: eventFields.tags.default([]),
  })
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
  reason: text({ min: 5, max: 255, multiline: true, tooShort: 'Give the organizer a short reason' }),
});
