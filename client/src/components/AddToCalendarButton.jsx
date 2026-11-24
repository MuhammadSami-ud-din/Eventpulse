import { downloadFile } from '../utils/download.js';
import { formatTicketCode } from '../utils/format.js';
import { buildIcs, icsFileName } from '../utils/ics.js';

export function AddToCalendarButton({ registration }) {
  const { event } = registration;

  function handleClick() {
    const ics = buildIcs({
      uid: `registration-${registration.id}@eventhub`,
      title: event.title,
      startsAt: event.startsAt,
      endsAt: event.endsAt,
      location: event.venue,
      description: registration.ticketCode ? `Ticket code: ${formatTicketCode(registration.ticketCode)}` : undefined,
      url: `${window.location.origin}/events/${event.id}`,
    });
    downloadFile(ics, icsFileName(event.title), 'text/calendar;charset=utf-8');
  }

  return (
    <button type="button" className="button" onClick={handleClick}>
      Add to calendar
    </button>
  );
}
