import { useEffect, useState } from 'react';
import { fetchTicketQr } from '../api/registrations.js';
import { isAbortError } from '../utils/errors.js';

export function TicketQr({ registrationId, ticketCode }) {
  const [imageUrl, setImageUrl] = useState(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    let objectUrl;
    fetchTicketQr(registrationId, { signal: controller.signal })
      .then((blob) => {
        objectUrl = URL.createObjectURL(blob);
        setImageUrl(objectUrl);
      })
      .catch((error) => !isAbortError(error) && setFailed(true));
    // Object URLs hold the image in memory until revoked.
    return () => {
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [registrationId]);

  if (failed) return <p className="ticket__fallback">QR code unavailable. Show the code below at the entrance.</p>;
  if (!imageUrl) return <div className="ticket__qr ticket__qr--loading" role="status" aria-label="Loading QR code" />;
  return <img className="ticket__qr" src={imageUrl} alt={`QR code for ticket ${ticketCode}`} width="280" height="280" />;
}
