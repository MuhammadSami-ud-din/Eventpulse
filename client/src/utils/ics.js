// Builds an iCalendar (.ics) file for one event, following RFC 5545.

const CRLF = '\r\n';
const MAX_LINE_BYTES = 75;
const encoder = new TextEncoder();

function escapeText(text) {
  return text.replace(/\\/g, '\\\\').replace(/\r?\n/g, '\\n').replace(/;/g, '\;').replace(/,/g, '\\,');
}

// 2026-11-28T09:00:00.000Z -> 20261128T090000Z
function formatUtc(date) {
  return new Date(date).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

// Lines longer than 75 bytes must be split; each continuation line starts with
// a space, which counts towards its 75. Splits between characters, never inside
// a multi-byte one, so Urdu or emoji titles stay valid UTF-8.
function foldLine(line) {
  const lines = [];
  let current = '';
  let currentBytes = 0;
  for (const char of line) {
    const charBytes = encoder.encode(char).length;
    const limit = lines.length === 0 ? MAX_LINE_BYTES : MAX_LINE_BYTES - 1;
    if (currentBytes + charBytes > limit) {
      lines.push(current);
      current = '';
      currentBytes = 0;
    }
    current += char;
    currentBytes += charBytes;
  }
  lines.push(current);
  return lines.join(`${CRLF} `);
}

export function buildIcs({ uid, title, startsAt, endsAt, location, description, url, now = new Date() }) {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//EventPulse//Campus Events//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${formatUtc(now)}`,
    `DTSTART:${formatUtc(startsAt)}`,
    `DTEND:${formatUtc(endsAt)}`,
    `SUMMARY:${escapeText(title)}`,
    location && `LOCATION:${escapeText(location)}`,
    description && `DESCRIPTION:${escapeText(description)}`,
    url && `URL:${url}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].filter(Boolean);
  return lines.map(foldLine).join(CRLF) + CRLF;
}

export function icsFileName(title) {
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return `${slug || 'event'}.ics`;
}
