import { Link } from 'react-router';
import { eventAvailability } from '../utils/eventStatus.js';
import { formatEventTime } from '../utils/format.js';
import { Badge } from './Badge.jsx';
import { SeatMeter } from './SeatMeter.jsx';

export function EventCard({ event }) {
  const availability = eventAvailability(event);
  return (
    <article className="card event-card">
      <div className="event-card__meta">
        <span className="event-card__category">{event.category.name}</span>
        <Badge tone={availability.tone}>{availability.label}</Badge>
      </div>
      <h3 className="event-card__title">
        {/* The whole card is clickable via CSS, but only the title is the real link. */}
        <Link to={`/events/${event.id}`} className="event-card__link">
          {event.title}
        </Link>
      </h3>
      <p className="event-card__detail">{formatEventTime(event.startsAt, event.endsAt)}</p>
      <p className="event-card__detail">{event.venue}</p>
      <SeatMeter event={event} />
    </article>
  );
}
