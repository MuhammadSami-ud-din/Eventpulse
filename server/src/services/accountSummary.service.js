import { pool } from '../db/pool.js';
import { queryEventPage } from './event.service.js';
import { listMyRegistrations } from './registrationQueries.service.js';

const SHOWN = 3;

const toNumbers = (row) => Object.fromEntries(Object.entries(row).map(([key, value]) => [key, Number(value)]));

// A student's numbers count confirmed seats for attendance, the same rule as
// the organizer's stats; "upcoming" also includes waitlist places.
async function studentSummary(userId) {
  const [[row]] = await pool.query(
    `SELECT
       COALESCE(SUM(r.status IN ('confirmed', 'waitlisted') AND e.ends_at >= UTC_TIMESTAMP()), 0) AS upcoming,
       COALESCE(SUM(r.status = 'confirmed' AND e.ends_at < UTC_TIMESTAMP()), 0) AS past,
       COALESCE(SUM(r.status = 'confirmed' AND a.status = 'attended'), 0) AS attended,
       COALESCE(SUM(r.status = 'confirmed' AND a.status = 'no_show'), 0) AS noShows
     FROM event_registrations r
     JOIN events e ON e.id = r.event_id
     LEFT JOIN event_attendance a ON a.registration_id = r.id
     WHERE r.user_id = ?`,
    [userId],
  );
  const stats = toNumbers(row);
  const marked = stats.attended + stats.noShows;
  const upcoming = await listMyRegistrations(userId, { scope: 'upcoming' });
  const past = await listMyRegistrations(userId, { scope: 'past', status: 'confirmed' });
  return {
    stats: { ...stats, attendanceRate: marked > 0 ? stats.attended / marked : null },
    upcoming: upcoming.filter((registration) => registration.status !== 'cancelled').slice(0, SHOWN),
    // Oldest first from the query, so the most recent ones are at the end.
    recent: past.slice(-SHOWN).reverse(),
  };
}

// Organizers (and admins) see the events they run themselves.
async function organizerSummary(userId) {
  const [[row]] = await pool.query(
    `SELECT
       COUNT(*) AS total,
       COALESCE(SUM(status = 'published'), 0) AS published,
       COALESCE(SUM(status = 'pending'), 0) AS pending,
       COALESCE(SUM(status = 'draft'), 0) AS drafts,
       COALESCE(SUM(status IN ('published', 'closed') AND ends_at < UTC_TIMESTAMP()), 0) AS past,
       COALESCE(SUM(confirmed_count), 0) AS seatsTaken
     FROM events WHERE organizer_id = ?`,
    [userId],
  );
  const upcoming = await queryEventPage({ organizerId: userId, from: new Date() }, { sort: 'date', page: 1, pageSize: SHOWN });
  return { stats: toNumbers(row), upcomingEvents: upcoming.data };
}

export async function getAccountSummary(user) {
  return user.role === 'student' ? studentSummary(user.id) : organizerSummary(user.id);
}
