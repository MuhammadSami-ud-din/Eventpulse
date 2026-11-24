import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { closeEvent, deleteEvent, fetchEventStats, publishEvent } from '../../api/organizer.js';
import { AttendanceBar } from '../../components/AttendanceBar.jsx';
import { ConfirmDialog } from '../../components/ConfirmDialog.jsx';
import { ManagedEventGate } from '../../components/ManagedEventGate.jsx';
import { OrganizerEventHeader } from '../../components/OrganizerEventHeader.jsx';
import { RegistrationsChart } from '../../components/RegistrationsChart.jsx';
import { StatTile } from '../../components/StatTile.jsx';
import { ErrorState, Loading } from '../../components/StateViews.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { useAsync } from '../../hooks/useAsync.js';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import { errorMessage } from '../../utils/errors.js';
import { hasEventStarted } from '../../utils/eventStatus.js';
import { formatDateTime, formatRate } from '../../utils/format.js';

const DELETABLE = new Set(['draft', 'pending', 'rejected']);

// The lifecycle buttons that make sense for this event right now. The server
// enforces the same rules; this just avoids offering actions that would fail.
function availableActions(event, role) {
  const actions = [];
  const started = hasEventStarted(event);
  if (['draft', 'rejected'].includes(event.status) && !started) {
    actions.push(role === 'admin' ? 'publish' : 'submit');
  }
  if (event.status === 'closed' && !started) actions.push('reopen');
  if (event.status === 'published' && !event.isPast) actions.push('close');
  if (DELETABLE.has(event.status)) actions.push('delete');
  return actions;
}

const ACTION_LABELS = {
  submit: 'Submit for approval',
  publish: 'Publish',
  reopen: 'Reopen registration',
  close: 'Close registration',
  delete: 'Delete',
};

const ACTION_SUCCESS = {
  submit: 'Submitted. An admin will review it shortly.',
  publish: 'Published. Students can now register.',
  reopen: 'Registration is open again.',
  close: 'Registration closed. Existing registrations are kept.',
};

function EventStats({ event }) {
  const { data: stats, error, isLoading, reload } = useAsync((signal) => fetchEventStats(event.id, { signal }), [event.id]);
  if (isLoading) return <Loading label="Loading stats…" />;
  if (error) return <ErrorState error={error} onRetry={reload} />;

  return (
    <section aria-labelledby="stats-heading" className="manage-section">
      <h2 id="stats-heading">Stats</h2>
      <div className="stat-grid">
        <StatTile label="Registered" value={`${stats.confirmed} / ${stats.capacity}`} detail="confirmed seats" />
        <StatTile label="Waitlisted" value={stats.waitlisted} />
        <StatTile label="Cancelled" value={stats.cancelled} />
        <StatTile label="Attended" value={stats.attended} />
        <StatTile label="No-shows" value={stats.noShows} />
        <StatTile label="Attendance rate" value={formatRate(stats.attendanceRate)} detail="of students marked" />
      </div>
      <div className="chart-grid">
        <div className="card">
          <AttendanceBar stats={stats} />
        </div>
        <div className="card">
          <RegistrationsChart days={stats.registrationsByDay} />
        </div>
      </div>
    </section>
  );
}

function EventOverview({ event, reload }) {
  const { user } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  useDocumentTitle(event.title);

  async function run(action) {
    setBusy(true);
    try {
      if (action === 'delete') {
        await deleteEvent(event.id);
        showToast({ type: 'success', message: 'Event deleted.' });
        navigate('/organizer');
        return;
      }
      await (action === 'close' ? closeEvent(event.id) : publishEvent(event.id));
      showToast({ type: 'success', message: ACTION_SUCCESS[action] });
      reload();
    } catch (error) {
      showToast({ type: 'error', message: errorMessage(error) });
    } finally {
      setBusy(false);
      setConfirmDelete(false);
    }
  }

  const actions = availableActions(event, user.role);
  return (
    <>
      <OrganizerEventHeader event={event} />
      {event.status === 'rejected' && (
        <p className="notice notice--danger" role="note">
          <strong>Not approved:</strong> {event.rejectionReason} Edit the event and submit it again.
        </p>
      )}
      {event.status === 'pending' && <p className="notice">Waiting for an admin to approve this event.</p>}

      <div className="action-bar">
        {actions.map((action) => (
          <button
            key={action}
            type="button"
            disabled={busy}
            className={`button ${action === 'delete' ? 'button--danger-outline' : 'button--primary'}`}
            onClick={() => (action === 'delete' ? setConfirmDelete(true) : run(action))}
          >
            {ACTION_LABELS[action]}
          </button>
        ))}
        {['published', 'closed'].includes(event.status) && (
          <Link to={`/events/${event.id}`} className="button">
            View public page
          </Link>
        )}
      </div>

      <dl className="facts facts--row">
        <div>
          <dt>Registration closes</dt>
          <dd>{formatDateTime(event.registrationDeadline)}</dd>
        </div>
        <div>
          <dt>Cancellation deadline</dt>
          <dd>{formatDateTime(event.cancellationDeadline)}</dd>
        </div>
        <div>
          <dt>Category</dt>
          <dd>{event.category.name}</dd>
        </div>
      </dl>

      <EventStats event={event} />

      <ConfirmDialog
        open={confirmDelete}
        title="Delete this event?"
        message="This cannot be undone."
        confirmLabel="Delete event"
        onConfirm={() => run('delete')}
        onCancel={() => setConfirmDelete(false)}
        busy={busy}
      />
    </>
  );
}

export function ManageEventPage() {
  return <ManagedEventGate>{(event, reload) => <EventOverview event={event} reload={reload} />}</ManagedEventGate>;
}
