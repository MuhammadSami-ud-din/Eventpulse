import { Link, useParams } from 'react-router';
import { fetchMyRegistration } from '../api/registrations.js';
import { AddToCalendarButton } from '../components/AddToCalendarButton.jsx';
import { EventCover } from '../components/EventCover.jsx';
import { DetailSkeleton } from '../components/Skeletons.jsx';
import { EmptyState, ErrorState } from '../components/StateViews.jsx';
import { TicketQr } from '../components/TicketQr.jsx';
import { useAsync } from '../hooks/useAsync.js';
import { useDocumentTitle } from '../hooks/useDocumentTitle.js';
import { errorCode } from '../utils/errors.js';
import { REGISTRATION_STATUS } from '../utils/eventStatus.js';
import { formatEventTime, formatTicketCode } from '../utils/format.js';

export function TicketPage() {
  const { id } = useParams();
  const { data: registration, error, isLoading, reload } = useAsync(
    (signal) => fetchMyRegistration(id, { signal }),
    [id],
  );
  useDocumentTitle('Ticket');

  if (isLoading) return <DetailSkeleton label="Loading ticket…" />;
  if (['REGISTRATION_NOT_FOUND', 'VALIDATION_ERROR'].includes(errorCode(error))) {
    return <EmptyState icon="ticket" title="Ticket not found" action={<Link to="/my/registrations" className="button">My registrations</Link>} />;
  }
  if (error) return <ErrorState error={error} onRetry={reload} />;

  const { event } = registration;
  return (
    <section className="ticket card">
      <Link to="/my/registrations" className="back-link">
        ← My registrations
      </Link>
      <EventCover eventId={event.id} coverUrl={event.coverUrl} className="ticket__cover" />
      <h1 className="ticket__title">{event.title}</h1>
      <p>{formatEventTime(event.startsAt, event.endsAt)}</p>
      <p>{event.venue}</p>

      {registration.ticketCode ? (
        <>
          <TicketQr registrationId={registration.id} ticketCode={registration.ticketCode} />
          <p className="ticket__code" aria-label={`Ticket code ${registration.ticketCode.split('').join(' ')}`}>
            {formatTicketCode(registration.ticketCode)}
          </p>
          <p className="ticket__hint">Show this at the entrance. Turn your screen brightness up for faster scanning.</p>
          <AddToCalendarButton registration={registration} />
        </>
      ) : (
        <p className="ticket__fallback">
          This registration is <strong>{REGISTRATION_STATUS[registration.status].label.toLowerCase()}</strong>, so there is
          no ticket to show.
        </p>
      )}
    </section>
  );
}
