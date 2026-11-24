import { fromLocalInputValue, toLocalInputValue } from './dateInput.js';
import { rules } from './validation.js';

export const EMPTY_EVENT_FORM = {
  title: '',
  categoryId: '',
  venue: '',
  description: '',
  startsAt: '',
  endsAt: '',
  registrationDeadline: '',
  capacity: '',
  cancellationWindowHours: '24',
  tagline: '',
  agenda: [],
  speakers: [],
  tags: '',
  whatToBring: '',
  entryNotes: '',
  contact: '',
};

// Same limits as the server (event.schemas.js).
export const DETAIL_LIMITS = { agendaItems: 20, speakers: 12, tags: 8 };
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;
const TAG_PATTERN = /^[\p{L}\p{N}][\p{L}\p{N} -]*$/u;

export const EMPTY_AGENDA_ITEM = { time: '', title: '', details: '' };
export const EMPTY_SPEAKER = { name: '', role: '' };

// "AI, Teams , coding" -> ["AI", "Teams", "coding"]
export const parseTags = (text) =>
  text
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean);

function tagsError(text) {
  const tags = parseTags(text);
  if (tags.length > DETAIL_LIMITS.tags) return `At most ${DETAIL_LIMITS.tags} tags`;
  const bad = tags.find((tag) => tag.length < 2 || tag.length > 30 || !TAG_PATTERN.test(tag));
  if (bad) return `"${bad}": tags are 2-30 letters, digits, spaces or hyphens`;
  return new Set(tags.map((tag) => tag.toLowerCase())).size === tags.length ? null : 'Each tag only once';
}

// The first problem in a list, named by its position ("Agenda item 2: …").
function firstItemError(items, label, check) {
  for (const [index, item] of items.entries()) {
    const problem = check(item);
    if (problem) return `${label} ${index + 1}: ${problem}`;
  }
  return null;
}

function agendaError(items) {
  if (items.length > DETAIL_LIMITS.agendaItems) return `At most ${DETAIL_LIMITS.agendaItems} agenda items`;
  return firstItemError(items, 'Agenda item', (item) => {
    if (!TIME_PATTERN.test(item.time)) return 'add a time';
    return (
      rules.plainText('the title')(item.title) ??
      lengthBetween(2, 120, 'The title')(item.title) ??
      rules.plainText('the details')(item.details) ??
      rules.maxLength(300, 'The details')(item.details)
    );
  });
}

function speakersError(items) {
  if (items.length > DETAIL_LIMITS.speakers) return `At most ${DETAIL_LIMITS.speakers} speakers or hosts`;
  return firstItemError(items, 'Speaker', (item) =>
    rules.plainText('the name')(item.name) ??
    lengthBetween(2, 100, 'The name')(item.name) ??
    rules.plainText('the role')(item.role) ??
    rules.maxLength(100, 'The role')(item.role),
  );
}

const time = (value) => new Date(value).getTime();
const DAY_MS = 24 * 60 * 60 * 1000;
// Same limits as the server: catches typos such as 2062 for 2026.
const MAX_DAYS_AHEAD = 2 * 365;
const MAX_DURATION_DAYS = 14;

const integerBetween = (min, max, label) => (value) => {
  const number = Number(value);
  return Number.isInteger(number) && number >= min && number <= max
    ? null
    : `${label} must be a whole number from ${min} to ${max}`;
};

const lengthBetween = (min, max, label) => (value) => {
  const length = value.trim().length;
  if (length < min) return `${label} must be at least ${min} characters`;
  return length > max ? `${label} must be at most ${max} characters` : null;
};

// Mirrors the server's scheduleIssues(): the server repeats every check.
export const EVENT_FORM_SCHEMA = {
  title: [rules.required('Title'), rules.plainText('Title'), lengthBetween(3, 150, 'Title')],
  categoryId: [rules.required('Category')],
  venue: [rules.required('Venue'), rules.plainText('Venue'), lengthBetween(2, 150, 'Venue')],
  description: [rules.required('Description'), rules.plainText('Description'), lengthBetween(10, 5000, 'Description')],
  startsAt: [
    rules.required('Start time'),
    (value) => (time(value) > Date.now() ? null : 'Start time must be in the future'),
    (value) => (time(value) <= Date.now() + MAX_DAYS_AHEAD * DAY_MS ? null : 'Events can be scheduled at most 2 years ahead'),
  ],
  endsAt: [
    rules.required('End time'),
    (value, values) => (time(value) > time(values.startsAt) ? null : 'End time must be after the start time'),
    (value, values) =>
      time(value) - time(values.startsAt) <= MAX_DURATION_DAYS * DAY_MS
        ? null
        : `An event can last at most ${MAX_DURATION_DAYS} days`,
  ],
  registrationDeadline: [
    rules.required('Registration deadline'),
    (value, values) =>
      time(value) <= time(values.startsAt) ? null : 'Registration must close before the event starts',
  ],
  capacity: [rules.required('Capacity'), integerBetween(1, 100000, 'Capacity')],
  cancellationWindowHours: [rules.required('Cancellation window'), integerBetween(0, 720, 'Cancellation window')],
  tagline: [rules.plainText('Tagline'), rules.maxLength(160, 'Tagline')],
  agenda: [agendaError],
  speakers: [speakersError],
  tags: [tagsError],
  whatToBring: [rules.plainText('What to bring'), rules.maxLength(500, 'What to bring')],
  entryNotes: [rules.plainText('Entry notes'), rules.maxLength(500, 'Entry notes')],
  contact: [rules.plainText('Contact'), rules.maxLength(255, 'Contact')],
};

export function toEventFormValues(event) {
  return {
    title: event.title,
    categoryId: String(event.category.id),
    venue: event.venue,
    description: event.description,
    startsAt: toLocalInputValue(event.startsAt),
    endsAt: toLocalInputValue(event.endsAt),
    registrationDeadline: toLocalInputValue(event.registrationDeadline),
    capacity: String(event.capacity),
    cancellationWindowHours: String(event.cancellationWindowHours),
    tagline: event.tagline ?? '',
    agenda: event.agenda.map((item) => ({ time: item.time, title: item.title, details: item.details ?? '' })),
    speakers: event.speakers.map((speaker) => ({ name: speaker.name, role: speaker.role ?? '' })),
    tags: event.tags.join(', '),
    whatToBring: event.whatToBring ?? '',
    entryNotes: event.entryNotes ?? '',
    contact: event.contact ?? '',
  };
}

// Optional parts of a list item are left out when empty rather than sent as "".
const withOptional = (key, value) => (value.trim() ? { [key]: value.trim() } : {});

export function toEventPayload(values) {
  return {
    title: values.title.trim(),
    categoryId: Number(values.categoryId),
    venue: values.venue.trim(),
    description: values.description.trim(),
    startsAt: fromLocalInputValue(values.startsAt),
    endsAt: fromLocalInputValue(values.endsAt),
    registrationDeadline: fromLocalInputValue(values.registrationDeadline),
    capacity: Number(values.capacity),
    cancellationWindowHours: Number(values.cancellationWindowHours),
    // An empty text clears the detail on the server.
    tagline: values.tagline.trim(),
    agenda: values.agenda.map((item) => ({ time: item.time, title: item.title.trim(), ...withOptional('details', item.details) })),
    speakers: values.speakers.map((speaker) => ({ name: speaker.name.trim(), ...withOptional('role', speaker.role) })),
    tags: parseTags(values.tags),
    whatToBring: values.whatToBring.trim(),
    entryNotes: values.entryNotes.trim(),
    contact: values.contact.trim(),
  };
}
