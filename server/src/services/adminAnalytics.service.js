import { pool } from '../db/pool.js';

const MONTHS_SHOWN = 6;
const EVENT_STATUSES = ['draft', 'pending', 'published', 'rejected', 'closed'];
const TOP_EVENTS = 5;

// MySQL returns SUM() and COUNT() as strings or BigInts; the API sends plain numbers.
const toNumbers = (row) => Object.fromEntries(Object.entries(row).map(([key, value]) => [key, Number(value)]));

async function countUsers() {
  const [rows] = await pool.query(
    'SELECT role, SUM(is_active) AS active, SUM(NOT is_active) AS disabled FROM users GROUP BY role',
  );
  const counts = { students: 0, organizers: 0, admins: 0, disabled: 0 };
  for (const row of rows) {
    counts[`${row.role}s`] = Number(row.active);
    counts.disabled += Number(row.disabled);
  }
  return counts;
}

async function countEventsByStatus() {
  const [rows] = await pool.query('SELECT status, COUNT(*) AS count FROM events GROUP BY status');
  const counts = Object.fromEntries(EVENT_STATUSES.map((status) => [status, 0]));
  for (const row of rows) counts[row.status] = Number(row.count);
  return counts;
}

async function countRegistrations() {
  const [[row]] = await pool.query(
    `SELECT
       COALESCE(SUM(status = 'confirmed'), 0) AS confirmed,
       COALESCE(SUM(status = 'waitlisted'), 0) AS waitlisted,
       COALESCE(SUM(status = 'cancelled'), 0) AS cancelled
     FROM event_registrations`,
  );
  return toNumbers(row);
}

// Only events that have ended, and only confirmed seats, as on the per-event page.
async function countAttendance() {
  const [[row]] = await pool.query(
    `SELECT
       COUNT(*) AS confirmed,
       COALESCE(SUM(a.status = 'attended'), 0) AS attended,
       COALESCE(SUM(a.status = 'no_show'), 0) AS noShows
     FROM event_registrations r
     JOIN events e ON e.id = r.event_id
     LEFT JOIN event_attendance a ON a.registration_id = r.id
     WHERE r.status = 'confirmed' AND e.ends_at <= UTC_TIMESTAMP()`,
  );
  const { confirmed, attended, noShows } = toNumbers(row);
  const marked = attended + noShows;
  return { attended, noShows, notMarked: confirmed - marked, attendanceRate: marked > 0 ? attended / marked : null };
}

// The last few calendar months in the viewer's time zone, oldest first, plus
// the UTC instant the oldest one starts. Shifting `now` by the offset makes its
// UTC fields read as the viewer's wall-clock time.
export function recentMonths(utcOffsetMinutes, now = new Date()) {
  const offsetMs = utcOffsetMinutes * 60 * 1000;
  const local = new Date(now.getTime() + offsetMs);
  const monthStart = (monthsBack) => Date.UTC(local.getUTCFullYear(), local.getUTCMonth() - monthsBack, 1);
  const months = [];
  for (let back = MONTHS_SHOWN - 1; back >= 0; back -= 1) {
    months.push(new Date(monthStart(back)).toISOString().slice(0, 7));
  }
  return { months, from: new Date(monthStart(MONTHS_SHOWN - 1) - offsetMs) };
}

// Every month is returned, with 0 for months without registrations, so the
// chart's time axis has no gaps.
async function registrationsByMonth(utcOffsetMinutes) {
  const { months, from } = recentMonths(utcOffsetMinutes);
  const [rows] = await pool.query(
    `SELECT DATE_FORMAT(registered_at + INTERVAL ? MINUTE, '%Y-%m') AS month, COUNT(*) AS count
     FROM event_registrations
     WHERE registered_at >= ?
     GROUP BY month`,
    [utcOffsetMinutes, from],
  );
  const counts = new Map(rows.map((row) => [row.month, Number(row.count)]));
  return months.map((month) => ({ month, count: counts.get(month) ?? 0 }));
}

// Seats and seats taken across each category's public (published or closed) events.
async function categoryDemand() {
  const [rows] = await pool.query(
    `SELECT c.id, c.name,
       COUNT(e.id) AS events,
       COALESCE(SUM(e.capacity), 0) AS seats,
       COALESCE(SUM(e.confirmed_count), 0) AS confirmed
     FROM event_categories c
     LEFT JOIN events e ON e.category_id = c.id AND e.status IN ('published', 'closed')
     GROUP BY c.id
     ORDER BY confirmed DESC, c.name`,
  );
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    events: Number(row.events),
    seats: Number(row.seats),
    confirmed: Number(row.confirmed),
  }));
}

// Upcoming published events, fullest first; ties go to the longer waitlist.
async function mostInDemandEvents() {
  const [rows] = await pool.query(
    `SELECT e.id, e.title, e.starts_at, e.capacity, e.confirmed_count,
       (SELECT COUNT(*) FROM event_registrations r
        WHERE r.event_id = e.id AND r.status = 'waitlisted') AS waitlisted
     FROM events e
     WHERE e.status = 'published' AND e.starts_at > UTC_TIMESTAMP()
     ORDER BY e.confirmed_count / e.capacity DESC, waitlisted DESC, e.starts_at
     LIMIT ?`,
    [TOP_EVENTS],
  );
  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    startsAt: row.starts_at,
    capacity: row.capacity,
    confirmed: row.confirmed_count,
    waitlisted: Number(row.waitlisted),
  }));
}

export async function getPlatformAnalytics({ utcOffsetMinutes }) {
  const [users, events, registrations, attendance, byMonth, categories, topEvents] = await Promise.all([
    countUsers(),
    countEventsByStatus(),
    countRegistrations(),
    countAttendance(),
    registrationsByMonth(utcOffsetMinutes),
    categoryDemand(),
    mostInDemandEvents(),
  ]);
  return { users, events, registrations, attendance, registrationsByMonth: byMonth, categories, topEvents };
}
