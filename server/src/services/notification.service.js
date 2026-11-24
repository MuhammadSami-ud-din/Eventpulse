import { pool } from '../db/pool.js';
import { HttpError } from '../utils/HttpError.js';
import { buildNotification } from './notificationMessages.js';
import { imageUrl } from '../utils/imageUrl.js';

// `db` is passed in so the notification is written in the caller's transaction:
// if the action rolls back, so does its notification.
export async function createNotification(db, { userId, eventId, type, eventTitle, detail }) {
  const { title, message } = buildNotification(type, eventTitle, detail);
  await db.execute(
    'INSERT INTO notifications (user_id, event_id, type, title, message) VALUES (?, ?, ?, ?, ?)',
    [userId, eventId, type, title, message],
  );
}

// Event notifications show who they are about: the event's organizer.
function toNotification(row) {
  return {
    id: row.id,
    eventId: row.event_id,
    organizer: row.organizer_id
      ? {
          id: row.organizer_id,
          name: row.organizer_name,
          avatarUrl: imageUrl('avatar', row.organizer_id, row.organizer_avatar_updated_at),
        }
      : null,
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
    `SELECT n.id, n.event_id, n.type, n.title, n.message, n.read_at, n.created_at,
            o.id AS organizer_id, o.full_name AS organizer_name, oa.updated_at AS organizer_avatar_updated_at
     FROM notifications n
     LEFT JOIN events e ON e.id = n.event_id
     LEFT JOIN users o ON o.id = e.organizer_id
     LEFT JOIN user_avatars oa ON oa.user_id = o.id
     WHERE n.user_id = ?
     ORDER BY n.created_at DESC, n.id DESC LIMIT ? OFFSET ?`,
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
