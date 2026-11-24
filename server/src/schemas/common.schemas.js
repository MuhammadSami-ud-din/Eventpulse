import { z } from 'zod';

// The largest value of the INT UNSIGNED id columns.
const MAX_ID = 4294967295;

// ---------- Numbers ----------

// Whole numbers that arrive as text (URL paths and query strings). Only the
// plain way of writing a number is accepted: z.coerce.number() would also take
// "1e3", "0x10", " 7", "007" and "" (as 0), and an array from ?page=1&page=2.
export function wholeNumberText({ min, max }) {
  return z
    .string({ error: 'Must be a whole number' })
    .regex(/^(0|-?[1-9]\d{0,9})$/, 'Must be a whole number')
    .transform(Number)
    .pipe(z.number().min(min, `Must be at least ${min}`).max(max, `Must be at most ${max}`));
}

// Whole numbers in JSON bodies must be JSON numbers: no strings, booleans or
// arrays. (z.number() also rejects Infinity, which "1e400" parses to.)
export function wholeNumber({ min, max }) {
  return z
    .number({ error: 'Must be a number' })
    .int('Must be a whole number')
    .min(min, `Must be at least ${min}`)
    .max(max, `Must be at most ${max}`);
}

export const idText = wholeNumberText({ min: 1, max: MAX_ID });
export const id = wholeNumber({ min: 1, max: MAX_ID });

export const idParamSchema = z.object({ id: idText });

export const paginationFields = {
  page: wholeNumberText({ min: 1, max: 10000 }).default(1),
  pageSize: wholeNumberText({ min: 1, max: 50 }).default(12),
};

// For charts bucketed by day or month in the viewer's time zone. The browser
// sends its offset from UTC in minutes (east positive), from -12h to +14h.
export const utcOffsetQuerySchema = z.object({
  utcOffsetMinutes: wholeNumberText({ min: -720, max: 840 }).default(0),
});

// ---------- Text ----------

// Characters that are invisible or change how the text around them is shown:
// - control characters (NUL, bell, escape…); line breaks and tabs are allowed
//   only in multi-line text;
// - bidirectional overrides and isolates, which can make a name display
//   reversed or reordered in a table or CSV export ("Trojan Source").
const SINGLE_LINE_FORBIDDEN = /[\u0000-\u001F\u007F-\u009F]/;
const MULTI_LINE_FORBIDDEN = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/;
const DIRECTION_CONTROLS = /[‪-‮⁦-⁩]/;
const LETTER_OR_DIGIT = /[\p{L}\p{N}]/u;

// Free text typed by a person. It is normalised to NFC first, so "é" typed as
// one character or as "e" plus an accent is stored (and compared) the same way.
// A required text (min > 0) must contain a letter or digit in any script, so
// it cannot be only spaces, zero-width spaces or punctuation.
export function text({ min = 0, max, multiline = false, tooShort = `Must be at least ${min} characters` }) {
  const forbidden = multiline ? MULTI_LINE_FORBIDDEN : SINGLE_LINE_FORBIDDEN;
  return z
    .string({ error: 'Must be text' })
    .transform((value) => value.normalize('NFC').trim())
    .pipe(
      z
        .string()
        .min(min, tooShort)
        .max(max, `Must be at most ${max} characters`)
        .refine((value) => !forbidden.test(value), multiline ? 'Remove control characters' : 'Remove line breaks and control characters')
        .refine((value) => !DIRECTION_CONTROLS.test(value), 'Remove text-direction control characters')
        .refine((value) => min === 0 || LETTER_OR_DIGIT.test(value), 'Must contain letters or digits'),
    );
}

// Optional text where an empty value means "none" and is stored as NULL.
export function optionalText(options) {
  return text(options)
    .transform((value) => value || null)
    .optional();
}

// ---------- Dates ----------

const EARLIEST_YEAR = 2000;
const LATEST_YEAR = 2100;

// Requires an explicit offset (e.g. "2026-12-01T09:00:00Z" or "+05:00") so the
// server never has to guess which time zone a bare date-time was meant in.
// `abort` stops parsing on failure, so object-level refinements that compare
// dates never receive the raw, unparsed string. The year range keeps dates
// sane for MySQL (which cannot store year 0) and for a campus calendar.
export const isoDateTime = z.iso
  .datetime({
    offset: true,
    abort: true,
    error: 'Use an ISO date-time with a time zone, e.g. 2026-12-01T09:00:00Z',
  })
  .transform((value) => new Date(value))
  .refine((date) => {
    const year = date.getUTCFullYear();
    return year >= EARLIEST_YEAR && year <= LATEST_YEAR;
  }, `Choose a date between ${EARLIEST_YEAR} and ${LATEST_YEAR}`);
