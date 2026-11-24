// <input type="datetime-local"> works in local time without a zone
// ("2026-12-01T14:30"); the API wants exact instants. These convert both ways.

const pad = (n) => String(n).padStart(2, '0');

export function toLocalInputValue(value) {
  if (!value) return '';
  const d = new Date(value);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// The spec says a date-time string without an offset is read as local time.
export function fromLocalInputValue(value) {
  return new Date(value).toISOString();
}
