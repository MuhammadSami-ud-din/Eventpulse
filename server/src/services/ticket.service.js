import QRCode from 'qrcode';
import { env } from '../config/env.js';
import { pool } from '../db/pool.js';
import { HttpError } from '../utils/HttpError.js';
import { toQrPayload } from '../utils/ticketCode.js';

// Medium error correction survives a cracked phone screen or glare while
// keeping the code coarse enough to scan quickly from a distance.
const QR_OPTIONS = { type: 'png', errorCorrectionLevel: 'M', margin: 2, width: 320 };

export function ticketQrPayload(ticketCode) {
  return toQrPayload(ticketCode, env.TICKET_BASE_URL);
}

export function renderTicketQr(ticketCode) {
  return QRCode.toBuffer(ticketQrPayload(ticketCode), QR_OPTIONS);
}

// Public: anyone holding the code (usually the student, via the QR link) can
// see whether the ticket is valid. It deliberately returns nothing about the
// holder, and cannot change anything (check-in stays organizer-only).
export async function getTicketStatus(ticketCode) {
  const [rows] = await pool.query(
    `SELECT r.status, a.checked_in_at,
            e.id AS event_id, e.title, e.venue, e.starts_at, e.ends_at
     FROM event_registrations r
     JOIN events e ON e.id = r.event_id
     LEFT JOIN event_attendance a ON a.registration_id = r.id AND a.status = 'attended'
     WHERE r.ticket_code = ?`,
    [ticketCode],
  );
  const row = rows[0];
  if (!row) throw new HttpError(404, 'TICKET_NOT_FOUND', 'No ticket with this code');
  return {
    status: row.status,
    checkedInAt: row.checked_in_at,
    event: { id: row.event_id, title: row.title, venue: row.venue, startsAt: row.starts_at, endsAt: row.ends_at },
  };
}
