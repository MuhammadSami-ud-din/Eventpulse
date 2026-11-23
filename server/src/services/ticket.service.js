import QRCode from 'qrcode';
import { toQrPayload } from '../utils/ticketCode.js';

// Medium error correction survives a cracked phone screen or glare while
// keeping the code coarse enough to scan quickly from a distance.
const QR_OPTIONS = { type: 'png', errorCorrectionLevel: 'M', margin: 2, width: 320 };

export function renderTicketQr(ticketCode) {
  return QRCode.toBuffer(toQrPayload(ticketCode), QR_OPTIONS);
}
