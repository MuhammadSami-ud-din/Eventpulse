import { Link, NavLink } from 'react-router';
import { EVENT_STATUS, hasEventStarted } from '../utils/eventStatus.js';
import { formatEventTime } from '../utils/format.js';
import { Badge } from './Badge.jsx';

const CHECK_IN_STATUSES = new Set(['published', 'closed']);

export function OrganizerEventHeader({ event }) {
  const status = EVENT_STATUS[event.status];
  const base = `/organizer/events/${event.id}`;
  return (
    <header className="manage-header">
      <Link to="/organizer" className="back-link">
        ← All my events
      </Link>
      <div className="manage-header__title">
        <h1>{event.title}</h1>
        <Badge tone={status.tone}>{status.label}</Badge>
        {event.isPast && <Badge>Ended</Badge>}
      </div>
      <p className="manage-header__meta">
        {formatEventTime(event.startsAt, event.endsAt)} · {event.venue}
      </p>
      <nav className="tabs" aria-label="Event sections">
        <NavLink to={base} end className="tabs__link">
          Overview
        </NavLink>
        <NavLink to={`${base}/registrations`} className="tabs__link">
          Registrations
        </NavLink>
        {CHECK_IN_STATUSES.has(event.status) && (
          <NavLink to={`${base}/check-in`} className="tabs__link">
            Check-in
          </NavLink>
        )}
        {!hasEventStarted(event) && (
          <NavLink to={`${base}/edit`} className="tabs__link">
            Edit
          </NavLink>
        )}
      </nav>
    </header>
  );
}
