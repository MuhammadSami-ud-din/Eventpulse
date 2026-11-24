const dateFormat = new Intl.DateTimeFormat(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
const timeFormat = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' });
const shortDateFormat = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short' });
const monthFormat = new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' });
const shortMonthFormat = new Intl.DateTimeFormat(undefined, { month: 'short' });
const dayFormat = new Intl.DateTimeFormat(undefined, { day: 'numeric' });
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

// "2026-11" -> "November 2026" / "Nov". Mid-month noon, so no time zone can shift it into another month.
export const formatMonth = (month) => monthFormat.format(new Date(`${month}-15T12:00:00`));
export const formatShortMonth = (month) => shortMonthFormat.format(new Date(`${month}-15T12:00:00`));

// 0.8 -> "80%"; null (nothing to measure yet) -> "—".
export const formatRate = (rate) => (rate === null ? '—' : `${Math.round(rate * 100)}%`);

// The month and day of a date, for a calendar-style badge ("NOV" over "28").
export const formatDateBadge = (value) => ({
  month: shortMonthFormat.format(toDate(value)),
  day: dayFormat.format(toDate(value)),
});

// Time left until a moment, in the two largest units: "2 days 4 hours",
// "3 hours 15 minutes", "12 minutes". Null once the moment has passed.
export function formatCountdown(ms) {
  if (ms <= 0) return null;
  const minutes = Math.floor(ms / 60000);
  if (minutes < 1) return 'less than a minute';
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  const mins = minutes % 60;
  const parts = [];
  if (days) parts.push(pluralize(days, 'day'));
  if (hours) parts.push(pluralize(hours, 'hour'));
  if (mins && !days) parts.push(pluralize(mins, 'minute'));
  return parts.slice(0, 2).join(' ');
}
