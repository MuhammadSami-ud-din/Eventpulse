import { Link, useParams } from 'react-router';
import { fetchTicketStatus } from '../api/tickets.js';
import { Badge } from '../components/Badge.jsx';
import { EmptyState, ErrorState, Loading } from '../components/StateViews.jsx';
import { useAsync } from '../hooks/useAsync.js';
import { useDocumentTitle } from '../hooks/useDocumentTitle.js';
import { errorCode } from '../utils/errors.js';
import { formatDateTime, formatEventTime, formatTicketCode } from '../utils/format.js';

function describe(ticket) {
  if (ticket.status === 'cancelled') return { tone: 'neutral', label: 'Cancelled', text: 'This ticket was cancelled and is not valid for entry.' };
  if (ticket.status === 'waitlisted') return { tone: 'warning', label: 'Waitlisted', text: 'This student is on the waitlist and does not have a seat yet.' };
  if (ticket.checkedInAt) return { tone: 'success', label: 'Checked in', text: `Checked in at ${formatDateTime(ticket.checkedInAt)}.` };
  return { tone: 'success', label: 'Valid ticket', text: 'This ticket is confirmed. Show it at the entrance to check in.' };
}

// Opened by scanning a ticket QR with a phone camera. Public and read-only:
// it shows the ticket's status, never who holds it, and cannot check anyone in.
export function TicketStatusPage() {
  const { code } = useParams();
  useDocumentTitle('Ticket status');
  const { data: ticket, error, isLoading, reload } = useAsync((signal) => fetchTicketStatus(code, { signal }), [code]);

  if (isLoading) return <Loading label="Checking ticket…" />;
  if (['TICKET_NOT_FOUND', 'VALIDATION_ERROR'].includes(errorCode(error))) {
    return <EmptyState icon="ticket" title="Ticket not found" message="Check the code and try again." action={<Link to="/" className="button">Browse events</Link>} />;
  }
  if (error) return <ErrorState error={error} onRetry={reload} />;

  const state = describe(ticket);
  return (
    <section className="ticket card">
      <Badge tone={state.tone}>{state.label}</Badge>
      <h1 className="ticket__title">{ticket.event.title}</h1>
      <p>{formatEventTime(ticket.event.startsAt, ticket.event.endsAt)}</p>
      <p>{ticket.event.venue}</p>
      <p className="ticket__code">{formatTicketCode(code.toUpperCase())}</p>
      <p className="ticket__hint">{state.text}</p>
      <Link to={`/events/${ticket.event.id}`} className="button">
        Event details
      </Link>
    </section>
  );
}
