import { pool } from '../db/pool.js';
import { HttpError } from '../utils/HttpError.js';
import { buildNotification } from './notificationMessages.js';

// `db` is passed in so the notification is written in the caller's transaction:
// if the action rolls back, so does its notification.
export async function createNotification(db, { userId, eventId, type, eventTitle, detail }) {
  const { title, message } = buildNotification(type, eventTitle, detail);
  await db.execute(
    'INSERT INTO notifications (user_id, event_id, type, title, message) VALUES (?, ?, ?, ?, ?)',
    [userId, eventId, type, title, message],
  );
}

function toNotification(row) {
  return {
    id: row.id,
    eventId: row.event_id,
    type: row.type,
    title: row.title,
    message: row.message,
    readAt: row.read_at,
    createdAt: row.created_at,
  };
}

export async function countUnread(userId) {
  const [[{ total }]] = await pool.query(
    'SELECT COUNT(*) AS total FROM notifications WHERE user_id = ? AND read_at IS NULL',
    [userId],
  );
  return total;
}

export async function listNotifications(userId, { page, pageSize }) {
  const [[{ total }]] = await pool.query('SELECT COUNT(*) AS total FROM notifications WHERE user_id = ?', [userId]);
  const [rows] = await pool.query(
    `SELECT id, event_id, type, title, message, read_at, created_at
     FROM notifications WHERE user_id = ?
     ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?`,
    [userId, pageSize, (page - 1) * pageSize],
  );
  return {
    data: rows.map(toNotification),
    unreadCount: await countUnread(userId),
    pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
  };
}

// The user id is part of the WHERE clause, so nobody can mark someone else's
// notification; it simply is not found. Marking twice keeps the first read time.
export async function markRead(userId, notificationId) {
  const [result] = await pool.query(
    'UPDATE notifications SET read_at = COALESCE(read_at, UTC_TIMESTAMP()) WHERE id = ? AND user_id = ?',
    [notificationId, userId],
  );
  if (result.affectedRows === 0) throw new HttpError(404, 'NOTIFICATION_NOT_FOUND', 'Notification not found');
  return { unreadCount: await countUnread(userId) };
}

export async function markAllRead(userId) {
  await pool.query('UPDATE notifications SET read_at = UTC_TIMESTAMP() WHERE user_id = ? AND read_at IS NULL', [userId]);
  return { unreadCount: 0 };
}
