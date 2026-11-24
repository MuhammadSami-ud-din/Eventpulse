import bcrypt from 'bcrypt';
import { env } from '../config/env.js';
import { pool } from '../db/pool.js';
import { withTransaction } from '../db/transaction.js';
import { HttpError } from '../utils/HttpError.js';
import { containsPattern } from '../utils/sql.js';
import { duplicateFieldError, revokeAllSessions } from './auth.service.js';
import { releaseUpcomingRegistrations } from './registration.service.js';
import { PUBLIC_USER_COLUMNS, toPublicUser } from './user.service.js';

const userNotFound = () => new HttpError(404, 'USER_NOT_FOUND', 'User not found');

// Unlike findActiveUserById, this also finds disabled accounts.
async function findUserById(userId) {
  const [rows] = await pool.query(`SELECT ${PUBLIC_USER_COLUMNS} FROM users WHERE id = ?`, [userId]);
  if (!rows[0]) throw userNotFound();
  return toPublicUser(rows[0]);
}

export async function listUsers({ q, role, page, pageSize }) {
  const conditions = [];
  const params = [];
  if (role) {
    conditions.push('role = ?');
    params.push(role);
  }
  if (q) {
    const pattern = containsPattern(q);
    conditions.push('(full_name LIKE ? OR email LIKE ? OR student_number LIKE ?)');
    params.push(pattern, pattern, pattern);
  }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const [[{ total }]] = await pool.query(`SELECT COUNT(*) AS total FROM users ${where}`, params);
  const [rows] = await pool.query(
    `SELECT ${PUBLIC_USER_COLUMNS} FROM users ${where}
     ORDER BY FIELD(role, 'admin', 'organizer', 'student'), full_name
     LIMIT ? OFFSET ?`,
    [...params, pageSize, (page - 1) * pageSize],
  );
  return {
    data: rows.map(toPublicUser),
    pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
  };
}

// The admin passes the starting password on; the user can change it on their profile.
export async function createAccount({ fullName, email, password, department, role }) {
  const passwordHash = await bcrypt.hash(password, env.BCRYPT_ROUNDS);
  try {
    const [result] = await pool.execute(
      'INSERT INTO users (full_name, email, password_hash, role, department) VALUES (?, ?, ?, ?, ?)',
      [fullName, email, passwordHash, role, department ?? null],
    );
    return findUserById(result.insertId);
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') throw duplicateFieldError(err);
    throw err;
  }
}

// Locks the acting admin's row and the target's row, always in id order so two
// admin actions can never deadlock. If two admins demote each other at the same
// moment, the second one waits, then finds it is no longer an admin.
// Refusing to change yourself means there is always at least one active admin.
async function lockActorAndTarget(conn, actorId, targetId) {
  if (actorId === targetId) {
    throw new HttpError(409, 'CANNOT_CHANGE_SELF', 'Ask another admin to change your own role or status');
  }
  const [rows] = await conn.query(
    'SELECT id, role, is_active, student_number FROM users WHERE id IN (?, ?) ORDER BY id FOR UPDATE',
    [actorId, targetId],
  );
  const actor = rows.find((row) => row.id === actorId);
  if (!actor || actor.role !== 'admin' || !actor.is_active) {
    throw new HttpError(403, 'FORBIDDEN', 'You do not have permission to do this');
  }
  const target = rows.find((row) => row.id === targetId);
  if (!target) throw userNotFound();
  return target;
}

async function holdsUpcomingRegistrations(conn, userId) {
  const [rows] = await conn.query(
    `SELECT 1 FROM event_registrations r
     JOIN events e ON e.id = r.event_id
     WHERE r.user_id = ? AND r.status IN ('confirmed', 'waitlisted') AND e.ends_at > UTC_TIMESTAMP()
     LIMIT 1`,
    [userId],
  );
  return rows.length > 0;
}

async function runsUpcomingEvents(conn, userId) {
  const [rows] = await conn.query(
    `SELECT 1 FROM events
     WHERE organizer_id = ? AND status IN ('draft', 'pending', 'published') AND ends_at > UTC_TIMESTAMP()
     LIMIT 1`,
    [userId],
  );
  return rows.length > 0;
}

// A role change must not strand anything: a student's tickets are only visible
// to students, and an organizer's events need an organizer.
async function assertRoleChangeAllowed(conn, target, newRole) {
  if (target.role === 'student' && (await holdsUpcomingRegistrations(conn, target.id))) {
    throw new HttpError(
      409,
      'HAS_ACTIVE_REGISTRATIONS',
      'This student is registered for events that have not ended yet',
    );
  }
  if (newRole !== 'student') return;
  if (!target.student_number) {
    throw new HttpError(409, 'STUDENT_NUMBER_REQUIRED', 'Only accounts with a student number can be students');
  }
  if (await runsUpcomingEvents(conn, target.id)) {
    throw new HttpError(
      409,
      'HAS_ACTIVE_EVENTS',
      'This user runs events that have not ended yet. Close or delete them first.',
    );
  }
}

// Takes effect on the user's next request: the auth middleware reads the role
// from the database every time, never from the token.
export async function changeRole(actor, userId, role) {
  await withTransaction(async (conn) => {
    const target = await lockActorAndTarget(conn, actor.id, userId);
    if (target.role === role) return;
    await assertRoleChangeAllowed(conn, target, role);
    await conn.query('UPDATE users SET role = ? WHERE id = ?', [role, userId]);
  });
  return findUserById(userId);
}

// Disabling logs the user out everywhere at once: refresh tokens are revoked
// and the auth middleware rejects their access token on the next request.
// Running it again on a disabled account is harmless, and retries releasing seats.
export async function setActive(actor, userId, isActive) {
  await withTransaction(async (conn) => {
    await lockActorAndTarget(conn, actor.id, userId);
    await conn.query('UPDATE users SET is_active = ? WHERE id = ?', [isActive, userId]);
    if (!isActive) await revokeAllSessions(conn, userId);
  });
  const releasedRegistrations = isActive ? 0 : await releaseUpcomingRegistrations(userId);
  return { user: await findUserById(userId), releasedRegistrations };
}
