import { pool } from '../db/pool.js';
import { HttpError } from '../utils/HttpError.js';
import { detectImageType, IMAGE_MAX_BYTES } from '../utils/imageType.js';
import { imageUrl } from '../utils/imageUrl.js';
import { PUBLIC_STATUSES } from './event.service.js';

// The two kinds of image, each owned by one row (a user or an event).
// Only these fixed table and column names are ever put into SQL text.
const KINDS = {
  avatar: { table: 'user_avatars', key: 'user_id' },
  cover: { table: 'event_covers', key: 'event_id' },
};

const imageNotFound = () => new HttpError(404, 'IMAGE_NOT_FOUND', 'Image not found');

export async function saveImage(kind, ownerId, bytes) {
  if (!Buffer.isBuffer(bytes) || bytes.length === 0) {
    throw new HttpError(400, 'IMAGE_REQUIRED', 'Send the image as the request body (JPEG, PNG or WebP)');
  }
  if (bytes.length > IMAGE_MAX_BYTES) {
    throw new HttpError(413, 'PAYLOAD_TOO_LARGE', 'Images can be at most 1 MB');
  }
  const mimeType = detectImageType(bytes);
  if (!mimeType) {
    throw new HttpError(400, 'UNSUPPORTED_IMAGE', 'This file is not a JPEG, PNG or WebP image');
  }
  const { table, key } = KINDS[kind];
  // execute() sends the bytes as binary; query() would inline them as hex text.
  await pool.execute(
    `INSERT INTO user_avatars (user_id, data, mime_type, byte_size, updated_at)
VALUES (?, ?, ?, ?, UTC_TIMESTAMP(3))
ON DUPLICATE KEY UPDATE
  data = VALUES(data), mime_type = VALUES(mime_type),
  byte_size = VALUES(byte_size), updated_at = VALUES(updated_at)`,
    [ownerId, bytes, mimeType, bytes.length],
  );
  const meta = await findImageMeta(kind, ownerId);
  return imageUrl(kind, ownerId, meta.updatedAt);
}

// Removing an image that is not there is not an error: the result is the same.
export async function removeImage(kind, ownerId) {
  const { table, key } = KINDS[kind];
  await pool.query(`DELETE FROM ${table} WHERE ${key} = ?`, [ownerId]);
}

// Everything except the image bytes, so a 304 answer never loads them.
export async function findImageMeta(kind, ownerId) {
  const { table, key } = KINDS[kind];
  const [rows] = await pool.query(`SELECT mime_type, byte_size, updated_at FROM ${table} WHERE ${key} = ?`, [ownerId]);
  if (!rows[0]) return null;
  return { mimeType: rows[0].mime_type, byteSize: rows[0].byte_size, updatedAt: rows[0].updated_at };
}

export async function loadImageData(kind, ownerId) {
  const { table, key } = KINDS[kind];
  const [rows] = await pool.query(`SELECT data FROM ${table} WHERE ${key} = ?`, [ownerId]);
  if (!rows[0]) throw imageNotFound();
  return rows[0].data;
}

// Who may see an avatar:
// - organizers' and admins' avatars are public (they appear on event pages);
// - a student's avatar only to the student, to admins, and to organizers of
//   events the student registered for (it shows in their registrations list).
// Returns whether the result may be cached by shared caches as well.
async function avatarAccess(viewer, ownerId) {
  const [[owner]] = await pool.query('SELECT role FROM users WHERE id = ?', [ownerId]);
  if (!owner) return null;
  if (owner.role !== 'student') return { isPublic: true };
  if (!viewer) return null;
  if (viewer.id === ownerId || viewer.role === 'admin') return { isPublic: false };
  const [rows] = await pool.query(
    `SELECT 1 FROM event_registrations r JOIN events e ON e.id = r.event_id
     WHERE r.user_id = ? AND e.organizer_id = ? LIMIT 1`,
    [ownerId, viewer.id],
  );
  return rows.length ? { isPublic: false } : null;
}

// A cover is public once its event is; before that, only the people who
// manage the event can see it (e.g. to preview a draft).
async function coverAccess(viewer, eventId) {
  const [[event]] = await pool.query('SELECT status, organizer_id FROM events WHERE id = ?', [eventId]);
  if (!event) return null;
  if (PUBLIC_STATUSES.includes(event.status)) return { isPublic: true };
  if (viewer && (viewer.role === 'admin' || viewer.id === event.organizer_id)) return { isPublic: false };
  return null;
}

// Not allowed and not there look the same (404), so ids cannot be probed.
export async function findViewableImage(kind, ownerId, viewer) {
  const access = kind === 'avatar' ? await avatarAccess(viewer, ownerId) : await coverAccess(viewer, ownerId);
  const meta = access && (await findImageMeta(kind, ownerId));
  if (!meta) throw imageNotFound();
  return { ...meta, isPublic: access.isPublic };
}
