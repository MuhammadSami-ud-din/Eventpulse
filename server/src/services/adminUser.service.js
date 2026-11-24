import { pool } from '../db/pool.js';
import { containsPattern } from '../utils/sql.js';
import { PUBLIC_USER_COLUMNS, toPublicUser } from './user.service.js';

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
