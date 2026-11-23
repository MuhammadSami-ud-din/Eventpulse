import { withTransaction } from '../db/transaction.js';
import { checkInOpensAt, hasCheckInOpened, hasEnded, hasStarted, isCheckInOpen } from '../utils/eventTiming.js';
import { HttpError } from '../utils/HttpError.js';

// Every function here takes an event the caller has already loaded through
// getManagedEvent(), i.e. it exists and the user is allowed to manage it.

function toAttendance(row) {
  return row ? { status: row.status, checkedInAt: row.checked_in_at, markedAt: row.marked_at } : null;
}

// Locks the registration row. Cancelling locks the same row, so a ticket
// cannot be cancelled and checked in at the same moment, and two staff
// scanning the same ticket at once are handled one after the other.
async function lockRegistration(conn, eventId, where, value) {
  const [rows] = await conn.query(
    `SELECT r.id, r.status, u.full_name, u.student_number, u.department
     FROM event_registrations r JOIN users u ON u.id = r.user_id
     WHERE r.event_id = ? AND ${where} = ?
     FOR UPDATE OF r`,
    [eventId, value],
  );
  return rows[0] ?? null;
}

async function findAttendance(conn, registrationId) {
  const [rows] = await conn.query(
    'SELECT status, checked_in_at, marked_at FROM event_attendance WHERE registration_id = ?',
    [registrationId],
  );
  return rows[0] ?? null;
}

async function saveAttendance(conn, registrationId, status, markedBy) {
  await conn.query(
    `INSERT INTO event_attendance (registration_id, status, checked_in_at, marked_by)
     VALUES (?, ?, ?, ?) AS incoming
     ON DUPLICATE KEY UPDATE
       status = incoming.status,
       checked_in_at = incoming.checked_in_at,
       marked_by = incoming.marked_by,
       marked_at = UTC_TIMESTAMP()`,
    [registrationId, status, status === 'attended' ? new Date() : null, markedBy],
  );
  return toAttendance(await findAttendance(conn, registrationId));
}

function assertConfirmed(registration) {
  if (registration.status === 'cancelled') {
    throw new HttpError(409, 'TICKET_CANCELLED', 'This registration was cancelled');
  }
  if (registration.status === 'waitlisted') {
    throw new HttpError(409, 'NOT_CONFIRMED', 'This student is on the waitlist and has no seat');
  }
}

function checkInResult(result, registration, attendance) {
  return {
    result,
    attendance,
    registration: {
      id: registration.id,
      student: {
        fullName: registration.full_name,
        studentNumber: registration.student_number,
        department: registration.department,
      },
    },
  };
}

// A repeat scan is not an error: cameras often read the same code twice, and
// the staff member needs the original time to spot a shared screenshot.
export async function checkIn(user, event, ticketCode) {
  if (!isCheckInOpen(event)) {
    throw new HttpError(
      409,
      'CHECK_IN_CLOSED',
      hasEnded(event)
        ? 'This event has ended; mark attendance from the registrations list instead'
        : `Check-in opens at ${checkInOpensAt(event).toISOString()}`,
    );
  }

  return withTransaction(async (conn) => {
    const registration = await lockRegistration(conn, event.id, 'r.ticket_code', ticketCode);
    if (!registration) throw new HttpError(404, 'TICKET_NOT_FOUND', 'No ticket with this code for this event');
    assertConfirmed(registration);

    const existing = await findAttendance(conn, registration.id);
    if (existing?.status === 'attended') {
      return checkInResult('already_checked_in', registration, toAttendance(existing));
    }
    return checkInResult('checked_in', registration, await saveAttendance(conn, registration.id, 'attended', user.id));
  });
}

// Manual marking from the registrations list, e.g. a student who forgot their phone.
export async function markAttendance(user, event, registrationId, status) {
  if (status === 'no_show' && !hasStarted(event)) {
    throw new HttpError(409, 'EVENT_NOT_STARTED', 'Students can only be marked as no-shows once the event starts');
  }
  if (status === 'attended' && !hasCheckInOpened(event)) {
    throw new HttpError(409, 'CHECK_IN_CLOSED', `Check-in opens at ${checkInOpensAt(event).toISOString()}`);
  }

  return withTransaction(async (conn) => {
    const registration = await lockRegistration(conn, event.id, 'r.id', registrationId);
    if (!registration) throw new HttpError(404, 'REGISTRATION_NOT_FOUND', 'Registration not found');
    assertConfirmed(registration);

    const existing = await findAttendance(conn, registration.id);
    // Re-marking someone as attended keeps their original check-in time.
    if (existing?.status === status) return toAttendance(existing);
    return saveAttendance(conn, registration.id, status, user.id);
  });
}

// After the event, everyone confirmed who never checked in becomes a no-show.
// Rows that already have a record (attended or no-show) are left untouched.
export async function markRemainingNoShows(user, event) {
  if (!hasEnded(event)) {
    throw new HttpError(409, 'EVENT_NOT_ENDED', 'Remaining students can be marked as no-shows after the event ends');
  }
  const [result] = await withTransaction((conn) =>
    conn.query(
      `INSERT INTO event_attendance (registration_id, status, marked_by)
       SELECT r.id, 'no_show', ?
       FROM event_registrations r
       LEFT JOIN event_attendance a ON a.registration_id = r.id
       WHERE r.event_id = ? AND r.status = 'confirmed' AND a.id IS NULL
       ON DUPLICATE KEY UPDATE status = event_attendance.status`,
      [user.id, event.id],
    ),
  );
  return { markedNoShow: result.affectedRows };
}
