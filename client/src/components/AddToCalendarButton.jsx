import { downloadFile } from '../utils/download.js';
import { formatTicketCode } from '../utils/format.js';
import { buildIcs, icsFileName } from '../utils/ics.js';
import { Icon } from './Icon.jsx';

// Downloads an .ics file. With a registration it carries the ticket code and
// keeps the id calendars already know; without one it describes the event.
export function AddToCalendarButton({ event, registration }) {
  const target = registration?.event ?? event;

  function handleClick() {
    const ics = buildIcs({
      uid: registration ? `registration-${registration.id}@eventhub` : `event-${target.id}@eventhub`,
      title: target.title,
      startsAt: target.startsAt,
      endsAt: target.endsAt,
      location: target.venue,
      description: registration?.ticketCode ? `Ticket code: ${formatTicketCode(registration.ticketCode)}` : undefined,
      url: `${window.location.origin}/events/${target.id}`,
    });
    downloadFile(ics, icsFileName(target.title), 'text/calendar;charset=utf-8');
  }

  return (
    <button type="button" className="button" onClick={handleClick}>
      <Icon name="calendar" size={16} />
      Add to calendar
    </button>
  );
}
