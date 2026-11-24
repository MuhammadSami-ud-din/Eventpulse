import { useState } from 'react';
import { Link, useLocation } from 'react-router';
import { cancelRegistration, fetchMyRegistrations, registerForEvent } from '../api/registrations.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useNotifications } from '../context/NotificationsContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { useAsync } from '../hooks/useAsync.js';
import { errorMessage } from '../utils/errors.js';
import { AddToCalendarButton } from './AddToCalendarButton.jsx';
import { ConfirmDialog } from './ConfirmDialog.jsx';

// The register / join waitlist / cancel area of the event page.
export function RegistrationPanel({ event, onChanged }) {
  const { user } = useAuth();
  const location = useLocation();

  if (!user) {
    return (
      <div className="panel">
        <p>Log in with your student account to register.</p>
        <Link to="/login" state={{ from: location }} className="button button--primary button--block">
          Log in to register
        </Link>
      </div>
    );
  }
  if (user.role !== 'student') {
    return <p className="panel">Only student accounts can register for events.</p>;
  }
  return <StudentRegistration event={event} onChanged={onChanged} />;
}

function StudentRegistration({ event, onChanged }) {
  const { showToast } = useToast();
  const { refreshUnreadCount } = useNotifications();
  const [busy, setBusy] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const { data: registration, isLoading, reload } = useAsync(
    (signal) =>
      fetchMyRegistrations({ eventId: event.id }, { signal }).then(
        (rows) => rows.find((row) => row.status !== 'cancelled') ?? null,
      ),
    [event.id],
  );

  function afterChange() {
    reload();
    onChanged();
    refreshUnreadCount();
  }

  async function handleRegister() {
    setBusy(true);
    try {
      const created = await registerForEvent(event.id);
      showToast({
        type: 'success',
        message:
          created.status === 'confirmed'
            ? 'You’re registered! Your ticket is in My registrations.'
            : `The event is full. You’re #${created.waitlistPosition} on the waitlist.`,
      });
    } catch (error) {
      showToast({ type: 'error', message: errorMessage(error) });
    } finally {
      setBusy(false);
      afterChange();
    }
  }

  async function handleCancel() {
    setBusy(true);
    try {
      await cancelRegistration(registration.id);
      showToast({ type: 'success', message: 'Your registration has been cancelled.' });
      setConfirmOpen(false);
    } catch (error) {
      // E.g. the cancellation window closed while the page was open: the server has the final say.
      showToast({ type: 'error', message: errorMessage(error) });
      setConfirmOpen(false);
    } finally {
      setBusy(false);
      afterChange();
    }
  }

  if (isLoading) return <p className="panel" role="status">Checking your registration…</p>;

  if (!registration) {
    if (!event.registrationOpen) return <p className="panel">Registration for this event is closed.</p>;
    const full = event.seatsLeft === 0;
    return (
      <div className="panel">
        {full && <p>The event is full. Join the waitlist and you’ll get a seat automatically if one opens up.</p>}
        <button type="button" className="button button--primary button--block" onClick={handleRegister} disabled={busy}>
          {busy ? 'Registering…' : full ? 'Join waitlist' : 'Register'}
        </button>
      </div>
    );
  }

  const isConfirmed = registration.status === 'confirmed';
  return (
    <div className="panel">
      <p className="panel__status">
        {isConfirmed ? '✓ You’re registered.' : `You’re #${registration.waitlistPosition} on the waitlist.`}
      </p>
      <div className="panel__actions">
        {isConfirmed && (
          <Link to={`/my/registrations/${registration.id}`} className="button button--primary">
            View ticket
          </Link>
        )}
        <AddToCalendarButton registration={registration} />
        {registration.canCancel && (
          <button type="button" className="button button--danger-outline" onClick={() => setConfirmOpen(true)}>
            {isConfirmed ? 'Cancel registration' : 'Leave waitlist'}
          </button>
        )}
      </div>
      {isConfirmed && !registration.canCancel && !event.isPast && (
        <p className="panel__note">The cancellation window has closed for this event.</p>
      )}
      <ConfirmDialog
        open={confirmOpen}
        title={isConfirmed ? 'Cancel your registration?' : 'Leave the waitlist?'}
        message={
          isConfirmed
            ? 'Your seat will go to the next person on the waitlist. You can register again later if seats are available.'
            : 'You will lose your place in line.'
        }
        confirmLabel={isConfirmed ? 'Cancel registration' : 'Leave waitlist'}
        onConfirm={handleCancel}
        onCancel={() => setConfirmOpen(false)}
        busy={busy}
      />
    </div>
  );
}
