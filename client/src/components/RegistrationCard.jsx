import { Link } from 'react-router';
import { ATTENDANCE_STATUS, REGISTRATION_STATUS } from '../utils/eventStatus.js';
import { formatEventTime } from '../utils/format.js';
import { AddToCalendarButton } from './AddToCalendarButton.jsx';
import { Badge } from './Badge.jsx';

export function RegistrationCard({ registration, onCancel }) {
  const { event, status, attendance } = registration;
  const statusInfo = REGISTRATION_STATUS[status];
  const isActive = status !== 'cancelled';

  return (
    <article className={`card registration-card ${isActive ? '' : 'registration-card--muted'}`}>
      <div className="registration-card__badges">
        <Badge tone={statusInfo.tone}>
          {status === 'waitlisted' ? `Waitlist #${registration.waitlistPosition}` : statusInfo.label}
        </Badge>
        {attendance && <Badge tone={ATTENDANCE_STATUS[attendance.status].tone}>{ATTENDANCE_STATUS[attendance.status].label}</Badge>}
      </div>
      <h2 className="registration-card__title">
        <Link to={`/events/${event.id}`}>{event.title}</Link>
      </h2>
      <p className="registration-card__detail">{formatEventTime(event.startsAt, event.endsAt)}</p>
      <p className="registration-card__detail">{event.venue}</p>
      {isActive && (
        <div className="registration-card__actions">
          {status === 'confirmed' && (
            <Link to={`/my/registrations/${registration.id}`} className="button button--primary">
              View ticket
            </Link>
          )}
          {new Date(event.endsAt) > new Date() && <AddToCalendarButton registration={registration} />}
          {registration.canCancel && (
            <button type="button" className="button button--danger-outline" onClick={() => onCancel(registration)}>
              {status === 'confirmed' ? 'Cancel' : 'Leave waitlist'}
            </button>
          )}
        </div>
      )}
    </article>
  );
}
