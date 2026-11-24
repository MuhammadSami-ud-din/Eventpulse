import { pool } from '../db/pool.js';
import { cancellationDeadline, hasStarted, isCancellationOpen } from '../utils/eventTiming.js';
import { HttpError } from '../utils/HttpError.js';
import { containsPattern } from '../utils/sql.js';
import { imageUrl } from '../utils/imageUrl.js';

// Stored positions are never renumbered (that would rewrite many rows on every
// cancellation), so the place in line is computed: waitlisted rows ahead + 1.
const WAITLIST_RANK = `
  CASE WHEN r.status = 'waitlisted' THEN (
    SELECT COUNT(*) FROM event_registrations w
    WHERE w.event_id = r.event_id AND w.status = 'waitlisted' AND w.waitlist_position <= r.waitlist_position
  ) END AS waitlist_rank`;

const STUDENT_VIEW_SELECT = `
  SELECT
    r.id, r.status, r.ticket_code, r.registered_at, r.promoted_at, r.cancelled_at, ${WAITLIST_RANK},
    e.id AS event_id, e.title, e.venue, e.starts_at, e.ends_at, e.status AS event_status,
    e.cancellation_window_hours, c.name AS category_name, c.slug AS category_slug,
    a.status AS attendance_status, a.checked_in_at, ec.updated_at AS cover_updated_at
  FROM event_registrations r
  JOIN events e ON e.id = r.event_id
  JOIN event_categories c ON c.id = e.category_id
  LEFT JOIN event_attendance a ON a.registration_id = r.id
  LEFT JOIN event_covers ec ON ec.event_id = e.id`;

function toAttendance(row) {
  return row.attendance_status ? { status: row.attendance_status, checkedInAt: row.checked_in_at } : null;
}

function canCancel(status, event, now) {
  if (status === 'confirmed') return isCancellationOpen(event, now);
  if (status === 'waitlisted') return !hasStarted(event, now);
  return false;
}

function toStudentRegistration(row, now = Date.now()) {
  const event = {
    id: row.event_id,
    title: row.title,
    venue: row.venue,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    status: row.event_status,
    cancellationWindowHours: row.cancellation_window_hours,
    category: { name: row.category_name, slug: row.category_slug },
    coverUrl: imageUrl('cover', row.event_id, row.cover_updated_at),
  };
  return {
    id: row.id,
    status: row.status,
    waitlistPosition: row.waitlist_rank === null ? null : Number(row.waitlist_rank),
    // The ticket is only a valid entry pass while the seat is confirmed.
    ticketCode: row.status === 'confirmed' ? row.ticket_code : null,
    registeredAt: row.registered_at,
    promotedAt: row.promoted_at,
    cancelledAt: row.cancelled_at,
    canCancel: canCancel(row.status, event, now),
    attendance: toAttendance(row),
    event: { ...event, cancellationDeadline: cancellationDeadline(event) },
  };
}

const SCOPE_CONDITIONS = {
  upcoming: 'e.ends_at >= UTC_TIMESTAMP()',
  past: 'e.ends_at < UTC_TIMESTAMP()',
};

export async function listMyRegistrations(userId, { eventId, scope, status }) {
  const conditions = ['r.user_id = ?'];
  const params = [userId];
  if (eventId) {
    conditions.push('r.event_id = ?');
    params.push(eventId);
  }
  if (status) {
    conditions.push('r.status = ?');
    params.push(status);
  }
  if (SCOPE_CONDITIONS[scope]) conditions.push(SCOPE_CONDITIONS[scope]);

  const [rows] = await pool.query(
    `${STUDENT_VIEW_SELECT} WHERE ${conditions.join(' AND ')} ORDER BY e.starts_at, r.id DESC`,
    params,
  );
  const now = Date.now();
  return rows.map((row) => toStudentRegistration(row, now));
}

// Ownership is enforced in SQL: another student's registration simply is not found.
export async function getRegistrationForUser(userId, registrationId) {
  const [rows] = await pool.query(`${STUDENT_VIEW_SELECT} WHERE r.id = ? AND r.user_id = ?`, [
    registrationId,
    userId,
  ]);
  if (!rows[0]) throw new HttpError(404, 'REGISTRATION_NOT_FOUND', 'Registration not found');
  return toStudentRegistration(rows[0]);
}

function toAttendeeRow(row) {
  return {
    id: row.id,
    status: row.status,
    waitlistPosition: row.waitlist_rank === null ? null : Number(row.waitlist_rank),
    registeredAt: row.registered_at,
    promotedAt: row.promoted_at,
    cancelledAt: row.cancelled_at,
    attendance: toAttendance(row),
    student: {
      id: row.user_id,
      fullName: row.full_name,
      email: row.email,
      studentNumber: row.student_number,
      department: row.department,
      avatarUrl: imageUrl('avatar', row.user_id, row.avatar_updated_at),
    },
  };
}

async function countByStatus(eventId) {
  const [rows] = await pool.query(
    'SELECT status, COUNT(*) AS total FROM event_registrations WHERE event_id = ? GROUP BY status',
    [eventId],
  );
  const counts = { confirmed: 0, waitlisted: 0, cancelled: 0 };
  for (const row of rows) counts[row.status] = row.total;
  return counts;
}

// For the organizer's registrations table. The caller must already have
// checked that the user manages this event.
export async function listEventRegistrations(eventId, { q, status, page, pageSize }) {
  const conditions = ['r.event_id = ?'];
  const params = [eventId];
  if (status) {
    conditions.push('r.status = ?');
    params.push(status);
  }
  if (q) {
    const pattern = containsPattern(q);
    conditions.push('(u.full_name LIKE ? OR u.email LIKE ? OR u.student_number LIKE ?)');
    params.push(pattern, pattern, pattern);
  }
  const from = `
    FROM event_registrations r
    JOIN users u ON u.id = r.user_id
    LEFT JOIN event_attendance a ON a.registration_id = r.id
    LEFT JOIN user_avatars ua ON ua.user_id = u.id
    WHERE ${conditions.join(' AND ')}`;

  const [[{ total }]] = await pool.query(`SELECT COUNT(*) AS total ${from}`, params);
  const [rows] = await pool.query(
    `SELECT r.id, r.status, r.registered_at, r.promoted_at, r.cancelled_at, ${WAITLIST_RANK},
            u.id AS user_id, u.full_name, u.email, u.student_number, u.department,
            a.status AS attendance_status, a.checked_in_at, ua.updated_at AS avatar_updated_at
     ${from}
     ORDER BY FIELD(r.status, 'confirmed', 'waitlisted', 'cancelled'), r.waitlist_position, r.registered_at
     LIMIT ? OFFSET ?`,
    [...params, pageSize, (page - 1) * pageSize],
  );

  return {
    data: rows.map(toAttendeeRow),
    counts: await countByStatus(eventId),
    pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
  };
}
