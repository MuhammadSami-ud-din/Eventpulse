import { pool } from '../db/pool.js';

// Every query that returns a user to the client selects these columns only,
// so password_hash can never leak by accident.
export const PUBLIC_USER_COLUMNS = `
  id, full_name, email, role, department, student_number, is_active, created_at`;

export function toPublicUser(row) {
  return {
    id: row.id,
    fullName: row.full_name,
    email: row.email,
    role: row.role,
    department: row.department,
    studentNumber: row.student_number,
    isActive: Boolean(row.is_active),
    createdAt: row.created_at,
  };
}

// `db` is the pool or a transaction connection; both expose execute().
export async function findActiveUserById(db, userId) {
  const [rows] = await db.execute(
    `SELECT ${PUBLIC_USER_COLUMNS} FROM users WHERE id = ? AND is_active = TRUE`,
    [userId],
  );
  return rows[0] ? toPublicUser(rows[0]) : null;
}

export async function updateProfile(userId, { fullName, department }) {
  await pool.execute('UPDATE users SET full_name = ?, department = ? WHERE id = ?', [fullName, department, userId]);
  return findActiveUserById(pool, userId);
}
