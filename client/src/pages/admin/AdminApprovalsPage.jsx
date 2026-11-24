import { useState } from 'react';
import { Link } from 'react-router';
import { approveEvent, rejectEvent } from '../../api/admin.js';
import { fetchManagedEvents } from '../../api/organizer.js';
import { AdminNav } from '../../components/AdminNav.jsx';
import { ConfirmDialog } from '../../components/ConfirmDialog.jsx';
import { FormField } from '../../components/FormField.jsx';
import { Pagination } from '../../components/Pagination.jsx';
import { EmptyState, ErrorState, Loading } from '../../components/StateViews.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { useAsync } from '../../hooks/useAsync.js';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import { errorMessage } from '../../utils/errors.js';
import { formatEventTime, pluralize } from '../../utils/format.js';

const REASON_MIN = 5;
const REASON_MAX = 255;

function reasonError(reason) {
  const length = reason.trim().length;
  if (length < REASON_MIN) return 'Give the organizer a short reason (at least 5 characters)';
  return length > REASON_MAX ? `Keep it under ${REASON_MAX} characters` : null;
}

export function AdminApprovalsPage() {
  useDocumentTitle('Event approvals');
  const { showToast } = useToast();
  const [page, setPage] = useState(1);
  const [busyId, setBusyId] = useState(null);
  const [rejecting, setRejecting] = useState(null);
  const [reason, setReason] = useState('');
  const [reasonTouched, setReasonTouched] = useState(false);

  // Admins see every organizer's events through the organizer endpoint.
  const pending = useAsync(
    (signal) => fetchManagedEvents({ status: 'pending', sort: 'date', page, pageSize: 10 }, { signal }),
    [page],
  );

  async function review(event, action) {
    setBusyId(event.id);
    try {
      if (action === 'approve') {
        await approveEvent(event.id);
        showToast({ type: 'success', message: `Approved: ${event.title}` });
      } else {
        await rejectEvent(event.id, reason.trim());
        showToast({ type: 'success', message: `Sent back to the organizer: ${event.title}` });
        setRejecting(null);
      }
      pending.reload();
    } catch (error) {
      showToast({ type: 'error', message: errorMessage(error) });
    } finally {
      setBusyId(null);
    }
  }

  function openReject(event) {
    setReason('');
    setReasonTouched(false);
    setRejecting(event);
  }

  function confirmReject() {
    setReasonTouched(true);
    if (!reasonError(reason)) review(rejecting, 'reject');
  }

  return (
    <>
      <h1>Admin</h1>
      <AdminNav />
      {pending.isLoading && <Loading label="Loading pending events…" />}
      {pending.error && <ErrorState error={pending.error} onRetry={pending.reload} />}
      {pending.data && pending.data.data.length === 0 && (
        <EmptyState title="All caught up" message="There are no events waiting for approval." />
      )}
      {pending.data && pending.data.data.length > 0 && (
        <>
          <p className="results-count" role="status">
            {pluralize(pending.data.pagination.total, 'event')} waiting for approval
          </p>
          <ul className="approval-list">
            {pending.data.data.map((event) => (
              <li key={event.id} className="card approval">
                <div className="approval__body">
                  <h2 className="approval__title">{event.title}</h2>
                  <p className="approval__meta">
                    {event.organizer.name} · {event.category.name} · {pluralize(event.capacity, 'seat')}
                  </p>
                  <p className="approval__meta">
                    {formatEventTime(event.startsAt, event.endsAt)} · {event.venue}
                  </p>
                  <p className="approval__description">{event.description}</p>
                </div>
                <div className="approval__actions">
                  <button type="button" className="button button--primary" disabled={busyId === event.id} onClick={() => review(event, 'approve')}>
                    Approve
                  </button>
                  <button type="button" className="button button--danger-outline" disabled={busyId === event.id} onClick={() => openReject(event)}>
                    Reject
                  </button>
                  <Link to={`/organizer/events/${event.id}`} className="button button--ghost">
                    Details
                  </Link>
                </div>
              </li>
            ))}
          </ul>
          <Pagination pagination={pending.data.pagination} onPageChange={setPage} />
        </>
      )}

      <ConfirmDialog
        open={Boolean(rejecting)}
        title="Reject this event?"
        message={rejecting ? `“${rejecting.title}” goes back to the organizer with your reason.` : ''}
        confirmLabel="Reject event"
        cancelLabel="Cancel"
        onConfirm={confirmReject}
        onCancel={() => setRejecting(null)}
        busy={busyId !== null}
      >
        <FormField
          label="Reason for the organizer"
          as="textarea"
          rows={3}
          maxLength={REASON_MAX}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          error={reasonTouched ? reasonError(reason) : null}
        />
      </ConfirmDialog>
    </>
  );
}
