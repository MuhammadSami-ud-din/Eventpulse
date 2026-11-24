import { pool } from '../db/pool.js';
import { toCsv } from '../utils/csv.js';

// Every function here takes an event the caller has already loaded through
// getManagedEvent(), i.e. it exists and the user is allowed to manage it.

// Attendance only counts for confirmed seats, so a record left on a
// registration that was later cancelled does not inflate the numbers.
async function countRegistrations(eventId) {
  const [[row]] = await pool.query(
    `SELECT
       COALESCE(SUM(r.status = 'confirmed'), 0) AS confirmed,
       COALESCE(SUM(r.status = 'waitlisted'), 0) AS waitlisted,
       COALESCE(SUM(r.status = 'cancelled'), 0) AS cancelled,
       COALESCE(SUM(r.status = 'confirmed' AND a.status = 'attended'), 0) AS attended,
       COALESCE(SUM(r.status = 'confirmed' AND a.status = 'no_show'), 0) AS noShows
     FROM event_registrations r
     LEFT JOIN event_attendance a ON a.registration_id = r.id
     WHERE r.event_id = ?`,
    [eventId],
  );
  return Object.fromEntries(Object.entries(row).map(([key, value]) => [key, Number(value)]));
}

// Days are counted in the viewer's time zone (passed as an offset in minutes,
// e.g. 300 for Pakistan), so a registration at 1 AM local time is not filed
// under the previous day as it would be in UTC.
async function registrationsByDay(eventId, utcOffsetMinutes) {
  const [rows] = await pool.query(
    `SELECT DATE_FORMAT(registered_at + INTERVAL ? MINUTE, '%Y-%m-%d') AS day, COUNT(*) AS count
     FROM event_registrations
     WHERE event_id = ?
     GROUP BY day
     ORDER BY day`,
    [utcOffsetMinutes, eventId],
  );
  return rows.map((row) => ({ date: row.day, count: Number(row.count) }));
}

export async function getEventStats(event, { utcOffsetMinutes }) {
  const counts = await countRegistrations(event.id);
  const marked = counts.attended + counts.noShows;
  return {
    capacity: event.capacity,
    ...counts,
    notMarked: counts.confirmed - marked,
    // Share of marked students who came; null until anyone is marked.
    attendanceRate: marked > 0 ? counts.attended / marked : null,
    registrationsByDay: await registrationsByDay(event.id, utcOffsetMinutes),
  };
}

const CSV_COLUMNS = [
  { header: 'Name', value: (row) => row.full_name },
  { header: 'Email', value: (row) => row.email },
  { header: 'Student number', value: (row) => row.student_number },
  { header: 'Department', value: (row) => row.department },
  { header: 'Status', value: (row) => row.status },
  { header: 'Waitlist position', value: (row) => row.waitlist_rank },
  { header: 'Registered at (UTC)', value: (row) => row.registered_at },
  { header: 'Cancelled at (UTC)', value: (row) => row.cancelled_at },
  { header: 'Attendance', value: (row) => row.attendance_status },
  { header: 'Checked in at (UTC)', value: (row) => row.checked_in_at },
];

// Every registration, not just one page of the table.
export async function exportRegistrationsCsv(event) {
  const [rows] = await pool.query(
    `SELECT u.full_name, u.email, u.student_number, u.department,
            r.status, r.registered_at, r.cancelled_at,
            CASE WHEN r.status = 'waitlisted' THEN (
              SELECT COUNT(*) FROM event_registrations w
              WHERE w.event_id = r.event_id AND w.status = 'waitlisted' AND w.waitlist_position <= r.waitlist_position
            ) END AS waitlist_rank,
            a.status AS attendance_status, a.checked_in_at
     FROM event_registrations r
     JOIN users u ON u.id = r.user_id
     LEFT JOIN event_attendance a ON a.registration_id = r.id
     WHERE r.event_id = ?
     ORDER BY FIELD(r.status, 'confirmed', 'waitlisted', 'cancelled'), r.waitlist_position, u.full_name`,
    [event.id],
  );
  return toCsv(rows, CSV_COLUMNS);
}

export function csvFileName(event) {
  const slug = event.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'event';
  return `${slug}-registrations.csv`;
}
