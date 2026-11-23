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
