import { Link, useParams } from 'react-router';
import { fetchEvent } from '../api/events.js';
import { Badge } from '../components/Badge.jsx';
import { RegistrationPanel } from '../components/RegistrationPanel.jsx';
import { SeatMeter } from '../components/SeatMeter.jsx';
import { DetailSkeleton } from '../components/Skeletons.jsx';
import { EmptyState, ErrorState } from '../components/StateViews.jsx';
import { useAsync } from '../hooks/useAsync.js';
import { useDocumentTitle } from '../hooks/useDocumentTitle.js';
import { usePolling } from '../hooks/usePolling.js';
import { errorCode } from '../utils/errors.js';
import { eventAvailability } from '../utils/eventStatus.js';
import { formatDateTime, formatEventTime, pluralize } from '../utils/format.js';

// Seat counts change as other students register; the server answers unchanged
// data with a cheap 304 thanks to its ETag.
const SEAT_REFRESH_MS = 15 * 1000;

export function EventDetailPage() {
  const { id } = useParams();
  const { data: event, error, isLoading, reload } = useAsync((signal) => fetchEvent(id, { signal }), [id]);
  useDocumentTitle(event?.title ?? 'Event');
  usePolling(reload, SEAT_REFRESH_MS, Boolean(event) && !event.isPast);

  if (isLoading) return <DetailSkeleton label="Loading event…" />;
  if (['EVENT_NOT_FOUND', 'VALIDATION_ERROR'].includes(errorCode(error))) {
    return (
      <EmptyState
        icon="calendar"
        title="Event not found"
        message="It may have been removed, or the link is wrong."
        action={<Link to="/" className="button">Browse events</Link>}
      />
    );
  }
  if (error) return <ErrorState error={error} onRetry={reload} />;

  const availability = eventAvailability(event);
  return (
    <article className="event-detail">
      <Link to="/" className="back-link">
        ← All events
      </Link>
      <header className="event-detail__header">
        <div className="event-detail__badges">
          <Badge>{event.category.name}</Badge>
          <Badge tone={availability.tone}>{availability.label}</Badge>
        </div>
        <h1>{event.title}</h1>
        <p className="event-detail__organizer">Hosted by {event.organizer.name}</p>
      </header>

      <div className="event-detail__layout">
        <div className="event-detail__main">
          <dl className="facts">
            <div>
              <dt>When</dt>
              <dd>{formatEventTime(event.startsAt, event.endsAt)}</dd>
            </div>
            <div>
              <dt>Where</dt>
              <dd>{event.venue}</dd>
            </div>
            <div>
              <dt>Registration closes</dt>
              <dd>{formatDateTime(event.registrationDeadline)}</dd>
            </div>
          </dl>
          <h2>About this event</h2>
          <p className="event-detail__description">{event.description}</p>

          <h2>Cancellation rules</h2>
          <ul className="rules">
            <li>
              Confirmed seats can be cancelled until <strong>{formatDateTime(event.cancellationDeadline)}</strong>
              {event.cancellationWindowHours > 0 && ` (${pluralize(event.cancellationWindowHours, 'hour')} before the start)`}.
            </li>
            <li>You can leave the waitlist any time before the event starts.</li>
            <li>When a seat is cancelled, the first person on the waitlist gets it automatically.</li>
          </ul>
        </div>

        <aside className="card event-detail__aside" aria-label="Registration">
          <SeatMeter event={event} />
          <RegistrationPanel event={event} onChanged={reload} />
        </aside>
      </div>
    </article>
  );
}
