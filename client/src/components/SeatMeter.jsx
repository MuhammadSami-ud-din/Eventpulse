import { pluralize } from '../utils/format.js';

export function SeatMeter({ event }) {
  const filled = Math.min(100, Math.round((event.confirmedCount / event.capacity) * 100));
  return (
    <div className="seat-meter">
      {/* The bar is decorative; the text below carries the same information. */}
      <div className="seat-meter__bar" aria-hidden="true">
        <div className="seat-meter__fill" style={{ width: `${filled}%` }} />
      </div>
      <p className="seat-meter__text">
        <strong>{event.seatsLeft === 0 ? 'No seats left' : `${pluralize(event.seatsLeft, 'seat')} left`}</strong>
        <span> of {event.capacity}</span>
        {event.waitlistCount > 0 && <span> · {event.waitlistCount} on the waitlist</span>}
      </p>
    </div>
  );
}
