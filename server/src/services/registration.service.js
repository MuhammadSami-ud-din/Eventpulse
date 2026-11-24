import { pool } from '../db/pool.js';
import { withTransaction } from '../db/transaction.js';
import { hasStarted, isCancellationOpen, isRegistrationOpen } from '../utils/eventTiming.js';
import { HttpError } from '../utils/HttpError.js';
import { generateTicketCode } from '../utils/ticketCode.js';
import { invalidateEvent } from './cache.js';
import { PUBLIC_STATUSES } from './event.service.js';
import { createNotification } from './notification.service.js';
import { getRegistrationForUser } from './registrationQueries.service.js';

// Lock order used everywhere: the event row first, then registration rows.
// Every writer for one event therefore queues on the same lock, which is what
// makes "check seats, then take a seat" safe and keeps transactions from deadlocking.

const TICKET_CODE_ATTEMPTS = 3;

const eventNotFound = () => new HttpError(404, 'EVENT_NOT_FOUND', 'Event not found');
const registrationNotFound = () => new HttpError(404, 'REGISTRATION_NOT_FOUND', 'Registration not found');

async function lockEvent(conn, eventId) {
  const [rows] = await conn.query(
    `SELECT id, title, status, capacity, confirmed_count, starts_at, registration_deadline,
            cancellation_window_hours
     FROM events WHERE id = ? FOR UPDATE`,
    [eventId],
  );
  const row = rows[0];
  if (!row) return null;
  return {
    id: row.id,
    title: row.title,
    status: row.status,
    capacity: row.capacity,
    confirmedCount: row.confirmed_count,
    startsAt: row.starts_at,
    registrationDeadline: row.registration_deadline,
    cancellationWindowHours: row.cancellation_window_hours,
  };
}

async function findActiveRegistration(conn, eventId, userId) {
  const [rows] = await conn.query(
    `SELECT id, status FROM event_registrations
     WHERE event_id = ? AND user_id = ? AND status IN ('confirmed', 'waitlisted')`,
    [eventId, userId],
  );
  return rows[0] ?? null;
}

async function nextWaitlistPosition(conn, eventId) {
  const [[{ last }]] = await conn.query(
    'SELECT MAX(waitlist_position) AS last FROM event_registrations WHERE event_id = ?',
    [eventId],
  );
  return (last ?? 0) + 1;
}

// A ticket-code collision is astronomically unlikely (32^10 codes), but the
// unique key would reject it, so retry with a fresh code instead of failing.
// A failed statement does not abort a MySQL transaction, so retrying is safe.
async function insertRegistration(conn, { eventId, userId, status, waitlistPosition }) {
  for (let attempt = 1; ; attempt += 1) {
    try {
      const [result] = await conn.query(
        `INSERT INTO event_registrations (event_id, user_id, status, waitlist_position, ticket_code)
         VALUES (?, ?, ?, ?, ?)`,
        [eventId, userId, status, waitlistPosition, generateTicketCode()],
      );
      return result.insertId;
    } catch (err) {
      const isTicketCollision = err.code === 'ER_DUP_ENTRY' && err.sqlMessage.includes('ticket_code');
      if (!isTicketCollision || attempt === TICKET_CODE_ATTEMPTS) throw err;
    }
  }
}

async function waitlistRank(conn, eventId, position) {
  const [[{ rank }]] = await conn.query(
    `SELECT COUNT(*) AS \`rank\` FROM event_registrations
     WHERE event_id = ? AND status = 'waitlisted' AND waitlist_position <= ?`,
    [eventId, position],
  );
  return rank;
}

function alreadyRegistered(status) {
  return new HttpError(
    409,
    'ALREADY_REGISTERED',
    status === 'waitlisted' ? 'You are already on the waitlist for this event' : 'You are already registered for this event',
  );
}

export async function register(user, eventId) {
  const registrationId = await withTransaction(async (conn) => {
    const event = await lockEvent(conn, eventId);
    if (!event || !PUBLIC_STATUSES.includes(event.status)) throw eventNotFound();
    if (!isRegistrationOpen(event)) {
      throw new HttpError(409, 'REGISTRATION_CLOSED', 'Registration for this event is closed');
    }

    // Safe without extra locking: we hold the event lock, so no other
    // registration for this event can be inserted until we commit.
    const existing = await findActiveRegistration(conn, eventId, user.id);
    if (existing) throw alreadyRegistered(existing.status);

    const hasSeat = event.confirmedCount < event.capacity;
    const waitlistPosition = hasSeat ? null : await nextWaitlistPosition(conn, eventId);
    const id = await insertRegistration(conn, {
      eventId,
      userId: user.id,
      status: hasSeat ? 'confirmed' : 'waitlisted',
      waitlistPosition,
    });

    if (hasSeat) {
      await conn.query('UPDATE events SET confirmed_count = confirmed_count + 1 WHERE id = ?', [eventId]);
    }
    await createNotification(conn, {
      userId: user.id,
      eventId,
      type: hasSeat ? 'registration_confirmed' : 'waitlisted',
      eventTitle: event.title,
      detail: hasSeat ? undefined : await waitlistRank(conn, eventId, waitlistPosition),
    });
    return id;
  });

  invalidateEvent(eventId);
  return getRegistrationForUser(user.id, registrationId);
}

// Moves waitlisted students (first come, first served) into any free seats.
// Must be called inside a transaction that already holds the event lock.
export async function fillOpenSeats(conn, eventId) {
  const [[event]] = await conn.query(
    'SELECT title, capacity, confirmed_count FROM events WHERE id = ? FOR UPDATE',
    [eventId],
  );
  const openSeats = event.capacity - event.confirmed_count;
  if (openSeats <= 0) return;

  const [waiting] = await conn.query(
    `SELECT id, user_id FROM event_registrations
     WHERE event_id = ? AND status = 'waitlisted'
     ORDER BY waitlist_position LIMIT ? FOR UPDATE`,
    [eventId, openSeats],
  );
  if (waiting.length === 0) return;

  await conn.query(
    `UPDATE event_registrations
     SET status = 'confirmed', waitlist_position = NULL, promoted_at = UTC_TIMESTAMP()
     WHERE id IN (?)`,
    [waiting.map((row) => row.id)],
  );
  await conn.query('UPDATE events SET confirmed_count = confirmed_count + ? WHERE id = ?', [
    waiting.length,
    eventId,
  ]);
  for (const row of waiting) {
    await createNotification(conn, { userId: row.user_id, eventId, type: 'promoted', eventTitle: event.title });
  }
}

// Confirmed seats can only be given up inside the event's cancellation window.
// Leaving the waitlist is allowed until the event starts: it frees no seat, so
// it cannot hurt the organizer's planning.
function assertCanCancel(registration, event) {
  if (registration.status === 'cancelled') {
    throw new HttpError(409, 'ALREADY_CANCELLED', 'This registration is already cancelled');
  }
  const windowOpen = registration.status === 'waitlisted' ? !hasStarted(event) : isCancellationOpen(event);
  if (!windowOpen) {
    throw new HttpError(
      409,
      'CANCELLATION_CLOSED',
      `Cancellations close ${event.cancellationWindowHours} hours before the event starts`,
    );
  }
}

// Possible when an event's cancellation window is 0 hours: check-in opens
// before the start, while cancelling is still allowed until the start.
async function isCheckedIn(conn, registrationId) {
  const [rows] = await conn.query(
    "SELECT 1 FROM event_attendance WHERE registration_id = ? AND status = 'attended'",
    [registrationId],
  );
  return rows.length > 0;
}

export async function cancel(user, registrationId) {
  // Ownership is part of the WHERE clause, so another student's registration
  // is indistinguishable from one that does not exist.
  const [rows] = await pool.query(
    'SELECT event_id FROM event_registrations WHERE id = ? AND user_id = ?',
    [registrationId, user.id],
  );
  if (!rows[0]) throw registrationNotFound();
  const eventId = rows[0].event_id;

  await withTransaction(async (conn) => {
    const event = await lockEvent(conn, eventId);
    // Re-read under lock: the status may have changed (e.g. promoted) since the check above.
    const [[registration]] = await conn.query(
      'SELECT id, status FROM event_registrations WHERE id = ? FOR UPDATE',
      [registrationId],
    );
    assertCanCancel(registration, event);
    if (await isCheckedIn(conn, registrationId)) {
      throw new HttpError(409, 'ALREADY_CHECKED_IN', 'You have already been checked in to this event');
    }

    await conn.query(
      `UPDATE event_registrations
       SET status = 'cancelled', waitlist_position = NULL, cancelled_at = UTC_TIMESTAMP()
       WHERE id = ?`,
      [registrationId],
    );
    await createNotification(conn, {
      userId: user.id,
      eventId,
      type: 'registration_cancelled',
      eventTitle: event.title,
    });

    if (registration.status === 'confirmed') {
      await conn.query('UPDATE events SET confirmed_count = confirmed_count - 1 WHERE id = ?', [eventId]);
      // Same transaction: if promotion fails, the cancellation rolls back too,
      // so a seat is never left empty while someone is still waiting for it.
      await fillOpenSeats(conn, eventId);
    }
  });

  invalidateEvent(eventId);
  return getRegistrationForUser(user.id, registrationId);
}
