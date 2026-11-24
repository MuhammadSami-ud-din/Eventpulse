import { randomUUID } from 'node:crypto';
import bcrypt from 'bcrypt';
import { env } from '../config/env.js';
import { pool } from '../db/pool.js';
import { withTransaction } from '../db/transaction.js';
import { HttpError } from '../utils/HttpError.js';
import { refreshTokenTtlMs, signAccessToken, signRefreshToken, verifyRefreshToken } from './token.service.js';
import { findActiveUserById, PUBLIC_USER_COLUMNS, toPublicUser } from './user.service.js';

// Two tabs refreshing at the same moment both send the same refresh token.
// A replay within this window is treated as that race, not as theft.
const REUSE_GRACE_MS = 10 * 1000;

// Compared against when the email does not exist, so a login for an unknown
// email takes as long as one with a wrong password (no account enumeration by timing).
const dummyHashPromise = bcrypt.hash(randomUUID(), env.BCRYPT_ROUNDS);

const invalidCredentials = () => new HttpError(401, 'INVALID_CREDENTIALS', 'Email or password is incorrect');
const invalidSession = () => new HttpError(401, 'INVALID_TOKEN', 'Your session is invalid, please log in again');

async function issueTokens(db, userId) {
  const { token: refreshToken, jti } = signRefreshToken(userId);
  await db.execute('INSERT INTO refresh_tokens (user_id, jti, expires_at) VALUES (?, ?, ?)', [
    userId,
    jti,
    new Date(Date.now() + refreshTokenTtlMs),
  ]);
  // Housekeeping: drop this user's expired tokens so the table does not grow forever.
  await db.execute('DELETE FROM refresh_tokens WHERE user_id = ? AND expires_at < UTC_TIMESTAMP()', [userId]);
  return { accessToken: signAccessToken(userId), refreshToken };
}

export function duplicateFieldError(err) {
  if (err.sqlMessage?.includes('uq_users_student_number')) {
    return new HttpError(409, 'STUDENT_NUMBER_TAKEN', 'This student number is already registered');
  }
  return new HttpError(409, 'EMAIL_TAKEN', 'An account with this email already exists');
}

export async function registerStudent({ fullName, email, password, department, studentNumber }) {
  const passwordHash = await bcrypt.hash(password, env.BCRYPT_ROUNDS);
  let userId;
  try {
    const [result] = await pool.execute(
      `INSERT INTO users (full_name, email, password_hash, role, department, student_number)
       VALUES (?, ?, ?, 'student', ?, ?)`,
      [fullName, email, passwordHash, department ?? null, studentNumber],
    );
    userId = result.insertId;
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') throw duplicateFieldError(err);
    throw err;
  }

  const user = await findActiveUserById(pool, userId);
  return { user, tokens: await issueTokens(pool, userId) };
}

export async function login({ email, password }) {
  const [rows] = await pool.execute(
    `SELECT ${PUBLIC_USER_COLUMNS}, password_hash FROM users WHERE email = ?`,
    [email],
  );
  const row = rows[0];
  const passwordMatches = await bcrypt.compare(password, row?.password_hash ?? (await dummyHashPromise));
  if (!row || !passwordMatches) throw invalidCredentials();
  // Only revealed after a correct password, so it does not help an attacker guess emails.
  if (!row.is_active) throw new HttpError(403, 'ACCOUNT_DISABLED', 'This account has been disabled');

  return { user: toPublicUser(row), tokens: await issueTokens(pool, row.id) };
}

// Rotation: each refresh token works once. The row is locked so two concurrent
// refreshes with the same token cannot both succeed.
export async function rotateRefreshToken(refreshToken) {
  const { userId, jti } = verifyRefreshToken(refreshToken);

  const outcome = await withTransaction(async (conn) => {
    const [rows] = await conn.execute(
      'SELECT user_id, revoked_at FROM refresh_tokens WHERE jti = ? FOR UPDATE',
      [jti],
    );
    const stored = rows[0];
    if (!stored || stored.user_id !== userId) return null;

    if (stored.revoked_at) {
      // A rotated token came back outside the race window: assume it was stolen
      // and log out every session of this user. Returning (not throwing) keeps
      // this revocation from being rolled back.
      if (Date.now() - stored.revoked_at.getTime() > REUSE_GRACE_MS) {
        await revokeAllSessions(conn, userId);
      }
      return null;
    }

    const user = await findActiveUserById(conn, userId);
    if (!user) return null;

    await conn.execute('UPDATE refresh_tokens SET revoked_at = UTC_TIMESTAMP() WHERE jti = ?', [jti]);
    return { user, tokens: await issueTokens(conn, userId) };
  });

  if (!outcome) throw invalidSession();
  return outcome;
}

// Logout must always succeed for the client, so an unreadable token is ignored.
export async function revokeRefreshToken(refreshToken) {
  let jti;
  try {
    ({ jti } = verifyRefreshToken(refreshToken));
  } catch {
    return;
  }
  await pool.execute(
    'UPDATE refresh_tokens SET revoked_at = UTC_TIMESTAMP() WHERE jti = ? AND revoked_at IS NULL',
    [jti],
  );
}

export async function revokeAllSessions(db, userId) {
  await db.execute(
    'UPDATE refresh_tokens SET revoked_at = UTC_TIMESTAMP() WHERE user_id = ? AND revoked_at IS NULL',
    [userId],
  );
}

// Changing the password logs out every other device (a stolen session should
// not survive it) and hands this device a fresh session in the same transaction.
export async function changePassword(userId, { currentPassword, newPassword }) {
  const [[row]] = await pool.execute('SELECT password_hash FROM users WHERE id = ?', [userId]);
  if (!(await bcrypt.compare(currentPassword, row.password_hash))) {
    // 400, not 401: a 401 would make the client think the session expired.
    throw new HttpError(400, 'VALIDATION_ERROR', 'Some fields are invalid', [
      { field: 'currentPassword', message: 'Current password is incorrect' },
    ]);
  }
  const passwordHash = await bcrypt.hash(newPassword, env.BCRYPT_ROUNDS);

  return withTransaction(async (conn) => {
    await conn.execute('UPDATE users SET password_hash = ? WHERE id = ?', [passwordHash, userId]);
    await revokeAllSessions(conn, userId);
    return { user: await findActiveUserById(conn, userId), tokens: await issueTokens(conn, userId) };
  });
}
