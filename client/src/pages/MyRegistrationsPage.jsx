import { useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { cancelRegistration, fetchMyRegistrations } from '../api/registrations.js';
import { ConfirmDialog } from '../components/ConfirmDialog.jsx';
import { RegistrationCard } from '../components/RegistrationCard.jsx';
import { EmptyState, ErrorState, Loading } from '../components/StateViews.jsx';
import { useNotifications } from '../context/NotificationsContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { useAsync } from '../hooks/useAsync.js';
import { useDocumentTitle } from '../hooks/useDocumentTitle.js';
import { errorMessage } from '../utils/errors.js';

const VIEWS = {
  upcoming: { label: 'Upcoming', query: { scope: 'upcoming' }, empty: 'You have no upcoming events.' },
  past: { label: 'Past', query: { scope: 'past' }, empty: 'Events you attended will show up here.' },
  cancelled: { label: 'Cancelled', query: { status: 'cancelled' }, empty: 'You have no cancelled registrations.' },
};

export function MyRegistrationsPage() {
  useDocumentTitle('My registrations');
  const [params, setParams] = useSearchParams();
  const view = VIEWS[params.get('view')] ? params.get('view') : 'upcoming';
  const { showToast } = useToast();
  const { refreshUnreadCount } = useNotifications();
  const [toCancel, setToCancel] = useState(null);
  const [cancelling, setCancelling] = useState(false);

  const { data, error, isLoading, reload } = useAsync(
    (signal) =>
      fetchMyRegistrations(VIEWS[view].query, { signal }).then((rows) =>
        // Upcoming and past only list active registrations; cancelled ones have their own tab.
        view === 'cancelled' ? rows : rows.filter((row) => row.status !== 'cancelled'),
      ),
    [view],
  );

  async function confirmCancel() {
    setCancelling(true);
    try {
      await cancelRegistration(toCancel.id);
      showToast({ type: 'success', message: `Cancelled: ${toCancel.event.title}` });
    } catch (cancelError) {
      showToast({ type: 'error', message: errorMessage(cancelError) });
    } finally {
      setCancelling(false);
      setToCancel(null);
      reload();
      refreshUnreadCount();
    }
  }

  return (
    <>
      <h1>My registrations</h1>
      <div className="segmented" role="group" aria-label="Show registrations">
        {Object.entries(VIEWS).map(([key, { label }]) => (
          <button key={key} type="button" className="segmented__option" aria-pressed={view === key} onClick={() => setParams({ view: key })}>
            {label}
          </button>
        ))}
      </div>

      {isLoading && <Loading label="Loading your registrations…" />}
      {error && <ErrorState error={error} onRetry={reload} />}
      {data && data.length === 0 && (
        <EmptyState
          title="Nothing here yet"
          message={VIEWS[view].empty}
          action={view === 'upcoming' && <Link to="/" className="button button--primary">Browse events</Link>}
        />
      )}
      {data && data.length > 0 && (
        <div className="registration-list">
          {data.map((registration) => (
            <RegistrationCard key={registration.id} registration={registration} onCancel={setToCancel} />
          ))}
        </div>
      )}

      <ConfirmDialog
        open={Boolean(toCancel)}
        title={toCancel?.status === 'waitlisted' ? 'Leave the waitlist?' : 'Cancel your registration?'}
        message={toCancel ? `“${toCancel.event.title}” — your spot will go to the next person in line.` : ''}
        confirmLabel={toCancel?.status === 'waitlisted' ? 'Leave waitlist' : 'Cancel registration'}
        onConfirm={confirmCancel}
        onCancel={() => setToCancel(null)}
        busy={cancelling}
      />
    </>
  );
}
