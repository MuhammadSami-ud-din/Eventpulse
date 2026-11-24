const dateFormat = new Intl.DateTimeFormat(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
const timeFormat = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' });
const shortDateFormat = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short' });
const dateTimeFormat = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' });

const toDate = (value) => (value instanceof Date ? value : new Date(value));

export const formatDate = (value) => dateFormat.format(toDate(value));
export const formatShortDate = (value) => shortDateFormat.format(toDate(value));
export const formatTime = (value) => timeFormat.format(toDate(value));
export const formatDateTime = (value) => dateTimeFormat.format(toDate(value));

// "Fri, 28 Nov 2026 · 2:00 PM – 5:00 PM", or both full dates for multi-day events.
export function formatEventTime(startsAt, endsAt) {
  const start = toDate(startsAt);
  const end = toDate(endsAt);
  if (start.toDateString() === end.toDateString()) {
    return `${formatDate(start)} · ${formatTime(start)} – ${formatTime(end)}`;
  }
  return `${formatDateTime(start)} – ${formatDateTime(end)}`;
}

// Groups a ticket code for reading aloud at the door: "ABCDE FGH23".
export const formatTicketCode = (code) => code.replace(/^(.{5})(.{5})$/, '$1 $2');

export const pluralize = (count, word, plural = `${word}s`) => `${count} ${count === 1 ? word : plural}`;
