import { Link, useParams } from 'react-router';
import { fetchManagedEvent } from '../api/organizer.js';
import { useAsync } from '../hooks/useAsync.js';
import { errorCode } from '../utils/errors.js';
import { DetailSkeleton } from './Skeletons.jsx';
import { EmptyState, ErrorState } from './StateViews.jsx';

const NOT_YOURS = new Set(['EVENT_NOT_FOUND', 'FORBIDDEN', 'VALIDATION_ERROR']);

// Loads the event from the URL for the organizer pages and renders
// children(event, reload) once it is available.
export function ManagedEventGate({ children }) {
  const { id } = useParams();
  const { data: event, error, isLoading, reload } = useAsync((signal) => fetchManagedEvent(id, { signal }), [id]);

  if (isLoading) return <DetailSkeleton label="Loading event…" />;
  if (NOT_YOURS.has(errorCode(error))) {
    return (
      <EmptyState
        icon="calendar"
        title="Event not found"
        message="It may have been deleted, or it belongs to another organizer."
        action={<Link to="/organizer" className="button">My events</Link>}
      />
    );
  }
  if (error) return <ErrorState error={error} onRetry={reload} />;
  return children(event, reload);
}
