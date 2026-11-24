import { useNow } from '../hooks/useNow.js';
import { eventAvailability } from '../utils/eventStatus.js';
import { formatCountdown, formatDateTime, pluralize } from '../utils/format.js';
import { AddToCalendarButton } from './AddToCalendarButton.jsx';
import { Badge } from './Badge.jsx';
import { RegistrationPanel } from './RegistrationPanel.jsx';
import { SeatMeter } from './SeatMeter.jsx';
import { ShareButton } from './ShareButton.jsx';

const MINUTE_MS = 60 * 1000;

// The registration side panel: status, seats, time left to register, the
// register/cancel controls and the cancellation rules. It stays in view while
// the page scrolls on wide screens.
export function RegisterCard({ event, onChanged }) {
  const now = useNow(MINUTE_MS / 2);
  const availability = eventAvailability(event);
  const timeLeft = event.registrationOpen ? formatCountdown(new Date(event.registrationDeadline).getTime() - now) : null;

  return (
    <aside className="card register-card" aria-labelledby="register-heading">
      <div className="register-card__header">
        <h2 id="register-heading" className="register-card__title">
          Registration
        </h2>
        <Badge tone={availability.tone}>{availability.label}</Badge>
      </div>
      <SeatMeter event={event} />
      {timeLeft && (
        <p className="register-card__countdown">
          Closes in <strong>{timeLeft}</strong>
          <span className="register-card__deadline"> · {formatDateTime(event.registrationDeadline)}</span>
        </p>
      )}
      <RegistrationPanel event={event} onChanged={onChanged} />

      <div className="register-card__rules">
        <h3 className="register-card__subtitle">Cancellation rules</h3>
        <ul>
          <li>
            Confirmed seats can be cancelled until {formatDateTime(event.cancellationDeadline)}
            {event.cancellationWindowHours > 0 && ` (${pluralize(event.cancellationWindowHours, 'hour')} before the start)`}.
          </li>
          <li>You can leave the waitlist any time before the event starts.</li>
          <li>A cancelled seat goes to the first person on the waitlist automatically.</li>
        </ul>
      </div>

      <div className="register-card__share">
        <ShareButton title={event.title} url={`${window.location.origin}/events/${event.id}`} />
        <AddToCalendarButton event={event} />
      </div>
    </aside>
  );
}
