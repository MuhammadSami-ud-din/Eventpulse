import { Link } from 'react-router';
import { eventAvailability } from '../utils/eventStatus.js';
import { formatDateBadge, formatEventTime } from '../utils/format.js';
import { Badge } from './Badge.jsx';
import { EventCover } from './EventCover.jsx';
import { Icon } from './Icon.jsx';
import { SeatMeter } from './SeatMeter.jsx';

export function EventCard({ event }) {
  const availability = eventAvailability(event);
  const date = formatDateBadge(event.startsAt);
  return (
    <article className="card event-card">
      {/* Decorative: the date is also written out below. */}
      <EventCover eventId={event.id} coverUrl={event.coverUrl} className="event-card__cover">
        <span className="event-card__date" aria-hidden="true">
          <span className="event-card__month">{date.month}</span>
          <span className="event-card__day">{date.day}</span>
        </span>
      </EventCover>
      <div className="event-card__body">
        <div className="event-card__meta">
          <span className="chip-label">{event.category.name}</span>
          <Badge tone={availability.tone}>{availability.label}</Badge>
        </div>
        <h3 className="event-card__title">
          {/* The whole card is clickable via CSS, but only the title is the real link. */}
          <Link to={`/events/${event.id}`} className="event-card__link">
            {event.title}
          </Link>
        </h3>
        <p className="event-card__detail">
          <Icon name="clock" size={16} />
          <time dateTime={event.startsAt}>{formatEventTime(event.startsAt, event.endsAt)}</time>
        </p>
        <p className="event-card__detail">
          <Icon name="pin" size={16} />
          {event.venue}
        </p>
        <SeatMeter event={event} />
      </div>
    </article>
  );
}
