import bcrypt from 'bcrypt';
import { isProduction } from '../../config/env.js';
import { buildNotification } from '../../services/notificationMessages.js';
import { generateTicketCode } from '../../utils/ticketCode.js';
import { pool } from '../pool.js';
import { ADMIN, CATEGORIES, EVENTS, ORGANIZERS, PASSWORDS, STUDENTS } from './data.js';

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

const SEED_BCRYPT_ROUNDS = 10;
const DEFAULT_DEADLINE_HOURS_BEFORE = 2;
const DEFAULT_CANCELLATION_WINDOW_HOURS = 24;
const ATTENDANCE_RATE = 0.8;
// Pakistan Standard Time has no daylight saving, so a fixed offset is exact.
const CAMPUS_UTC_OFFSET_HOURS = 5;
const REVIEWED_STATUSES = new Set(['published', 'closed', 'rejected']);

// Child tables first so the order also works with foreign key checks on.
const TABLES = ['notifications', 'event_attendance', 'event_registrations', 'events', 'event_categories', 'users'];

// TRUNCATE is DDL and commits implicitly, so it runs before the insert transaction.
async function clearTables(conn) {
  await conn.query('SET FOREIGN_KEY_CHECKS = 0');
  try {
    for (const table of TABLES) {
      await conn.query(`TRUNCATE TABLE ${table}`);
    }
  } finally {
    await conn.query('SET FOREIGN_KEY_CHECKS = 1');
  }
}

async function insertUsers(conn) {
  const [studentHash, organizerHash, adminHash] = await Promise.all(
    [PASSWORDS.student, PASSWORDS.organizer, PASSWORDS.admin].map((password) =>
      bcrypt.hash(password, SEED_BCRYPT_ROUNDS),
    ),
  );

  const rows = [
    [ADMIN.fullName, ADMIN.email, adminHash, 'admin', null, null],
    ...ORGANIZERS.map((o) => [o.fullName, o.email, organizerHash, 'organizer', o.department, null]),
    ...STUDENTS.map((s) => [s.fullName, s.email, studentHash, 'student', s.department, s.studentNumber]),
  ];
  await conn.query(
    'INSERT INTO users (full_name, email, password_hash, role, department, student_number) VALUES ?',
    [rows],
  );

  const [inserted] = await conn.query('SELECT id, email FROM users');
  const idByEmail = new Map(inserted.map((row) => [row.email, row.id]));
  return {
    adminId: idByEmail.get(ADMIN.email),
    organizerIds: ORGANIZERS.map((o) => idByEmail.get(o.email)),
    studentIds: STUDENTS.map((s) => idByEmail.get(s.email)),
  };
}

async function insertCategories(conn) {
  const rows = CATEGORIES.map((c) => [c.name, c.slug, c.description]);
  await conn.query('INSERT INTO event_categories (name, slug, description) VALUES ?', [rows]);

  const [inserted] = await conn.query('SELECT id, slug FROM event_categories');
  return new Map(inserted.map((row) => [row.slug, row.id]));
}

// UTC timestamp for `startTime` (campus local, "HH:MM") on the campus date `days` from today.
function campusDateTime(now, days, startTime) {
  const [hours, minutes] = startTime.split(':').map(Number);
  const campusToday = new Date(now + CAMPUS_UTC_OFFSET_HOURS * HOUR);
  return Date.UTC(
    campusToday.getUTCFullYear(),
    campusToday.getUTCMonth(),
    campusToday.getUTCDate() + days,
    hours - CAMPUS_UTC_OFFSET_HOURS,
    minutes,
  );
}

function buildSchedule(event, now) {
  const startsAt = campusDateTime(now, event.startsInDays, event.startTime);
  const deadlineHoursBefore = event.registrationDeadlineHoursBefore ?? DEFAULT_DEADLINE_HOURS_BEFORE;
  const reviewedAt = Math.min(now, startsAt) - 3 * DAY;
  return {
    startsAt: new Date(startsAt),
    endsAt: new Date(startsAt + event.durationHours * HOUR),
    registrationDeadline: new Date(startsAt - deadlineHoursBefore * HOUR),
    reviewedAt: new Date(reviewedAt),
    createdAt: new Date(reviewedAt - DAY),
  };
}

async function insertEvent(conn, event, schedule, { organizerId, categoryId, adminId }) {
  const isReviewed = REVIEWED_STATUSES.has(event.status);
  const [result] = await conn.execute(
    `INSERT INTO events (
       organizer_id, category_id, title, description, venue,
       starts_at, ends_at, registration_deadline, cancellation_window_hours,
       capacity, confirmed_count, status, rejection_reason, reviewed_by, reviewed_at, created_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      organizerId,
      categoryId,
      event.title,
      event.description,
      event.venue,
      schedule.startsAt,
      schedule.endsAt,
      schedule.registrationDeadline,
      event.cancellationWindowHours ?? DEFAULT_CANCELLATION_WINDOW_HOURS,
      event.capacity,
      event.confirmed,
      event.status,
      event.rejectionReason ?? null,
      isReviewed ? adminId : null,
      isReviewed ? schedule.reviewedAt : null,
      schedule.createdAt,
    ],
  );
  return result.insertId;
}

// Rotates through the student list so each event gets a different mix of students.
function pickStudents(studentIds, eventIndex, count) {
  const start = (eventIndex * 7) % studentIds.length;
  return Array.from({ length: count }, (_, i) => studentIds[(start + i) % studentIds.length]);
}

// Returns confirmed students first, then the waitlist in order, then cancellations,
// each with a registration time spaced 45 minutes apart before the deadline.
function planRegistrations(event, eventIndex, studentIds, schedule, now) {
  const total = event.confirmed + event.waitlisted + event.cancelled;
  const latest = Math.min(now, schedule.registrationDeadline.getTime());

  return pickStudents(studentIds, eventIndex, total).map((userId, i) => {
    const registeredAt = new Date(latest - (total - i) * 45 * MINUTE);
    if (i < event.confirmed) {
      return { userId, registeredAt, status: 'confirmed', waitlistPosition: null, cancelledAt: null };
    }
    if (i < event.confirmed + event.waitlisted) {
      const waitlistPosition = i - event.confirmed + 1;
      return { userId, registeredAt, status: 'waitlisted', waitlistPosition, cancelledAt: null };
    }
    const cancelledAt = new Date(registeredAt.getTime() + 30 * MINUTE);
    return { userId, registeredAt, status: 'cancelled', waitlistPosition: null, cancelledAt };
  });
}

async function insertRegistration(conn, eventId, plan) {
  const [result] = await conn.execute(
    `INSERT INTO event_registrations
       (event_id, user_id, status, waitlist_position, ticket_code, registered_at, cancelled_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [eventId, plan.userId, plan.status, plan.waitlistPosition, generateTicketCode(), plan.registeredAt, plan.cancelledAt],
  );
  return result.insertId;
}

// Past events get attendance for every confirmed seat: most attended, the rest no-shows.
async function insertAttendance(conn, registrationIds, schedule, organizerId) {
  const attendedCount = Math.round(registrationIds.length * ATTENDANCE_RATE);
  const rows = registrationIds.map((registrationId, i) => {
    const attended = i < attendedCount;
    const checkedInAt = attended ? new Date(schedule.startsAt.getTime() + i * 2 * MINUTE) : null;
    return [registrationId, attended ? 'attended' : 'no_show', checkedInAt, organizerId, checkedInAt ?? schedule.endsAt];
  });
  if (rows.length === 0) return;
  await conn.query(
    'INSERT INTO event_attendance (registration_id, status, checked_in_at, marked_by, marked_at) VALUES ?',
    [rows],
  );
}

const NOTIFICATION_TYPE_BY_STATUS = {
  confirmed: 'registration_confirmed',
  waitlisted: 'waitlisted',
  cancelled: 'registration_cancelled',
};

function registrationNotification(plan, eventId, event, isPast) {
  const { type, title, message } = buildNotification(
    NOTIFICATION_TYPE_BY_STATUS[plan.status],
    event.title,
    plan.waitlistPosition,
  );
  const createdAt = plan.cancelledAt ?? plan.registeredAt;
  return [plan.userId, eventId, type, title, message, isPast ? createdAt : null, createdAt];
}

function reviewNotification(organizerId, eventId, event, schedule) {
  const type = event.status === 'rejected' ? 'event_rejected' : 'event_approved';
  const { title, message } = buildNotification(type, event.title, event.rejectionReason);
  return [organizerId, eventId, type, title, message, schedule.reviewedAt, schedule.reviewedAt];
}

async function insertEventsWithActivity(conn, { adminId, organizerIds, studentIds, categoryIds }) {
  const now = Date.now();
  const notifications = [];

  for (const [eventIndex, event] of EVENTS.entries()) {
    const organizerId = organizerIds[event.organizer];
    const schedule = buildSchedule(event, now);
    const isPast = schedule.endsAt.getTime() < now;
    const eventId = await insertEvent(conn, event, schedule, {
      organizerId,
      categoryId: categoryIds.get(event.category),
      adminId,
    });

    if (REVIEWED_STATUSES.has(event.status)) {
      notifications.push(reviewNotification(organizerId, eventId, event, schedule));
    }

    const confirmedRegistrationIds = [];
    for (const plan of planRegistrations(event, eventIndex, studentIds, schedule, now)) {
      const registrationId = await insertRegistration(conn, eventId, plan);
      if (plan.status === 'confirmed') confirmedRegistrationIds.push(registrationId);
      notifications.push(registrationNotification(plan, eventId, event, isPast));
    }

    if (isPast) {
      await insertAttendance(conn, confirmedRegistrationIds, schedule, organizerId);
    }
  }

  await conn.query(
    'INSERT INTO notifications (user_id, event_id, type, title, message, read_at, created_at) VALUES ?',
    [notifications],
  );
}

async function printSummary(conn) {
  for (const table of TABLES.toReversed()) {
    const [[{ total }]] = await conn.query(`SELECT COUNT(*) AS total FROM ${table}`);
    console.log(`  ${table.padEnd(20)} ${total}`);
  }
}

async function seed() {
  if (isProduction) throw new Error('Refusing to seed a production database.');

  const conn = await pool.getConnection();
  try {
    await clearTables(conn);
    await conn.beginTransaction();
    try {
      const users = await insertUsers(conn);
      const categoryIds = await insertCategories(conn);
      await insertEventsWithActivity(conn, { ...users, categoryIds });
      await conn.commit();
    } catch (err) {
      await conn.rollback();
      throw err;
    }
    console.log('Seed complete:');
    await printSummary(conn);
  } finally {
    conn.release();
  }
}

seed()
  .catch((err) => {
    console.error(`Seeding failed: ${err.message}`);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
