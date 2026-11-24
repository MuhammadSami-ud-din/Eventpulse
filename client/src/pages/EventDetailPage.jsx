import { Link, useParams } from 'react-router';
import { fetchEvent } from '../api/events.js';
import { EventHero, EventSections, RelatedEvents } from '../components/EventDetails.jsx';
import { RegisterCard } from '../components/RegisterCard.jsx';
import { DetailSkeleton } from '../components/Skeletons.jsx';
import { EmptyState, ErrorState } from '../components/StateViews.jsx';
import { useAsync } from '../hooks/useAsync.js';
import { useDocumentTitle } from '../hooks/useDocumentTitle.js';
import { usePolling } from '../hooks/usePolling.js';
import { errorCode } from '../utils/errors.js';

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

  return (
    <article className="event-page">
      <Link to="/" className="back-link">
        ← All events
      </Link>
      <EventHero event={event} />
      <div className="event-page__layout">
        <div className="event-page__main">
          <EventSections event={event} />
        </div>
        <RegisterCard event={event} onChanged={reload} />
      </div>
      <RelatedEvents event={event} />
    </article>
  );
}
