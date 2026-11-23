import { pool } from '../db/pool.js';
import { withTransaction } from '../db/transaction.js';
import { scheduleIssues } from '../schemas/event.schemas.js';
import { hasStarted } from '../utils/eventTiming.js';
import { HttpError } from '../utils/HttpError.js';
import { invalidateEvent } from './cache.js';
import { findEventById, queryEventPage } from './event.service.js';
import { createNotification } from './notification.service.js';
import { fillOpenSeats } from './registration.service.js';

// Maps API field names to columns. Only these keys can ever reach an UPDATE.
const COLUMN_BY_FIELD = {
  title: 'title',
  description: 'description',
  venue: 'venue',
  categoryId: 'category_id',
  startsAt: 'starts_at',
  endsAt: 'ends_at',
  registrationDeadline: 'registration_deadline',
  cancellationWindowHours: 'cancellation_window_hours',
  capacity: 'capacity',
};

const DELETABLE_STATUSES = new Set(['draft', 'pending', 'rejected']);
const SUBMITTABLE_STATUSES = new Set(['draft', 'rejected']);

const notFound = () => new HttpError(404, 'EVENT_NOT_FOUND', 'Event not found');
const invalidTransition = (status, action) =>
  new HttpError(409, 'INVALID_STATUS', `A ${status} event cannot be ${action}`);

function assertCanManage(user, event) {
  if (user.role !== 'admin' && event.organizer.id !== user.id) {
    throw new HttpError(403, 'FORBIDDEN', 'You can only manage your own events');
  }
}

// Locks the event row for the rest of the transaction. Registrations lock the
// same row, so an edit and a registration can never interleave.
async function lockManagedEvent(conn, user, eventId) {
  const [rows] = await conn.query('SELECT id FROM events WHERE id = ? FOR UPDATE', [eventId]);
  if (!rows[0]) throw notFound();
  const event = await findEventById(conn, eventId);
  assertCanManage(user, event);
  return event;
}

function assertNotStarted(event) {
  if (hasStarted(event)) throw new HttpError(409, 'EVENT_STARTED', 'This event has already started');
}

function categoryErrorOr(err) {
  if (err.code === 'ER_NO_REFERENCED_ROW_2') {
    return new HttpError(400, 'VALIDATION_ERROR', 'Some fields are invalid', [
      { field: 'categoryId', message: 'Category does not exist' },
    ]);
  }
  return err;
}

// Runs a change to one event in a transaction, then drops it from the cache
// and returns the fresh copy.
async function changeEvent(user, eventId, change) {
  await withTransaction(async (conn) => change(conn, await lockManagedEvent(conn, user, eventId)));
  invalidateEvent(eventId);
  return findEventById(pool, eventId);
}

// Organizers see their own events; admins see everyone's (used as the review queue).
export function listManagedEvents(user, { q, status, sort, page, pageSize }) {
  return queryEventPage(
    { q, statuses: status ? [status] : null, organizerId: user.role === 'admin' ? null : user.id },
    { sort, page, pageSize },
  );
}

export async function getManagedEvent(user, eventId) {
  const event = await findEventById(pool, eventId);
  if (!event) throw notFound();
  assertCanManage(user, event);
  return event;
}

export async function createEvent(user, data) {
  try {
    const [result] = await pool.execute(
      `INSERT INTO events (
         organizer_id, category_id, title, description, venue, starts_at, ends_at,
         registration_deadline, cancellation_window_hours, capacity, status
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft')`,
      [
        user.id,
        data.categoryId,
        data.title,
        data.description,
        data.venue,
        data.startsAt,
        data.endsAt,
        data.registrationDeadline,
        data.cancellationWindowHours,
        data.capacity,
      ],
    );
    return findEventById(pool, result.insertId);
  } catch (err) {
    throw categoryErrorOr(err);
  }
}

export function updateEvent(user, eventId, patch) {
  return changeEvent(user, eventId, async (conn, event) => {
    assertNotStarted(event);

    const issues = scheduleIssues({ ...event, ...patch });
    if (issues.length) throw new HttpError(400, 'VALIDATION_ERROR', 'Some fields are invalid', issues);
    if (patch.capacity !== undefined && patch.capacity < event.confirmedCount) {
      throw new HttpError(409, 'CAPACITY_TOO_LOW', `Capacity cannot be below the ${event.confirmedCount} confirmed seats`);
    }

    const fields = Object.keys(patch);
    const assignments = fields.map((field) => `${COLUMN_BY_FIELD[field]} = ?`);
    // Editing a rejected event turns it back into a draft the organizer can resubmit.
    if (event.status === 'rejected') assignments.push("status = 'draft'", 'rejection_reason = NULL');

    try {
      await conn.query(`UPDATE events SET ${assignments.join(', ')} WHERE id = ?`, [
        ...fields.map((field) => patch[field]),
        eventId,
      ]);
    } catch (err) {
      throw categoryErrorOr(err);
    }
    if (patch.capacity > event.capacity) await fillOpenSeats(conn, eventId);
  });
}

export async function deleteEvent(user, eventId) {
  await withTransaction(async (conn) => {
    const event = await lockManagedEvent(conn, user, eventId);
    if (!DELETABLE_STATUSES.has(event.status)) {
      throw new HttpError(409, 'INVALID_STATUS', 'Only unpublished events can be deleted; close it instead');
    }
    await conn.query('DELETE FROM events WHERE id = ?', [eventId]);
  });
  invalidateEvent(eventId);
}

// Organizers submit drafts for approval; an admin's own events skip the queue.
// A closed event is re-opened directly because it was already approved once.
export function publishEvent(user, eventId) {
  return changeEvent(user, eventId, async (conn, event) => {
    assertNotStarted(event);
    if (event.registrationDeadline.getTime() <= Date.now()) {
      throw new HttpError(409, 'DEADLINE_PASSED', 'Move the registration deadline into the future first');
    }

    if (event.status === 'closed') {
      await conn.query("UPDATE events SET status = 'published' WHERE id = ?", [eventId]);
    } else if (!SUBMITTABLE_STATUSES.has(event.status)) {
      throw invalidTransition(event.status, 'published');
    } else if (user.role === 'admin') {
      await conn.query(
        `UPDATE events SET status = 'published', rejection_reason = NULL,
           reviewed_by = ?, reviewed_at = UTC_TIMESTAMP() WHERE id = ?`,
        [user.id, eventId],
      );
    } else {
      await conn.query("UPDATE events SET status = 'pending', rejection_reason = NULL WHERE id = ?", [eventId]);
    }
  });
}

export function closeEvent(user, eventId) {
  return changeEvent(user, eventId, async (conn, event) => {
    if (event.status !== 'published') throw invalidTransition(event.status, 'closed');
    await conn.query("UPDATE events SET status = 'closed' WHERE id = ?", [eventId]);
  });
}

async function reviewEvent(admin, eventId, { approve, reason }) {
  return changeEvent(admin, eventId, async (conn, event) => {
    if (event.status !== 'pending') throw invalidTransition(event.status, approve ? 'approved' : 'rejected');
    if (approve) assertNotStarted(event);

    await conn.query(
      `UPDATE events SET status = ?, rejection_reason = ?, reviewed_by = ?, reviewed_at = UTC_TIMESTAMP()
       WHERE id = ?`,
      [approve ? 'published' : 'rejected', approve ? null : reason, admin.id, eventId],
    );
    await createNotification(conn, {
      userId: event.organizer.id,
      eventId,
      type: approve ? 'event_approved' : 'event_rejected',
      eventTitle: event.title,
      detail: reason,
    });
  });
}

export function approveEvent(admin, eventId) {
  return reviewEvent(admin, eventId, { approve: true });
}

export function rejectEvent(admin, eventId, reason) {
  return reviewEvent(admin, eventId, { approve: false, reason });
}
