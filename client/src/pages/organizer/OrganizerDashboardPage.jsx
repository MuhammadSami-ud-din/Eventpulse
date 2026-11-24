import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { fetchManagedEvents } from '../../api/organizer.js';
import { Badge } from '../../components/Badge.jsx';
import { Pagination } from '../../components/Pagination.jsx';
import { TableSkeleton } from '../../components/Skeletons.jsx';
import { EmptyState, ErrorState } from '../../components/StateViews.jsx';
import { TableWrap } from '../../components/TableWrap.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { useAsync } from '../../hooks/useAsync.js';
import { useDebouncedValue } from '../../hooks/useDebouncedValue.js';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import { EVENT_STATUS } from '../../utils/eventStatus.js';
import { formatEventTime } from '../../utils/format.js';

const STATUS_FILTERS = [['', 'All statuses'], ...Object.entries(EVENT_STATUS).map(([value, { label }]) => [value, label])];

export function OrganizerDashboardPage() {
  const { user } = useAuth();
  const isAdmin = user.role === 'admin';
  useDocumentTitle(isAdmin ? 'Manage events' : 'My events');
  const [params, setParams] = useSearchParams();
  const status = params.get('status') ?? '';
  const page = Number(params.get('page')) || 1;
  const [search, setSearch] = useState(params.get('q') ?? '');
  const q = useDebouncedValue(search.trim());

  function setFilter(changes) {
    const next = new URLSearchParams(params);
    for (const [key, value] of Object.entries(changes)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    if (!('page' in changes)) next.delete('page');
    setParams(next, { replace: 'q' in changes });
  }

  // Typing -> URL, after the debounce.
  useEffect(() => {
    if (q !== (params.get('q') ?? '')) setFilter({ q });
  }, [q]);

  const events = useAsync(
    (signal) =>
      fetchManagedEvents({ status: status || undefined, q: params.get('q') || undefined, page, pageSize: 20 }, { signal }),
    [params.toString()],
  );
  const hasFilters = Boolean(status || params.get('q'));

  return (
    <>
      <div className="page-header">
        <h1>{isAdmin ? 'Manage events' : 'My events'}</h1>
        <Link to="/organizer/events/new" className="button button--primary">
          New event
        </Link>
      </div>

      <div className="toolbar">
        <div className="field field--inline">
          <label htmlFor="event-search" className="field__label">
            Search
          </label>
          <input
            id="event-search"
            data-shortcut="search"
            type="search"
            className="field__control"
            placeholder="Event title, venue…"
            maxLength={100}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="field field--inline">
          <label htmlFor="status-filter" className="field__label">
            Status
          </label>
          <select id="status-filter" className="field__control" value={status} onChange={(e) => setFilter({ status: e.target.value })}>
            {STATUS_FILTERS.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {events.isLoading && <TableSkeleton label="Loading events…" columns={5} />}
      {events.error && <ErrorState error={events.error} onRetry={events.reload} />}
      {events.data && events.data.data.length === 0 && (
        <EmptyState
          icon="calendar"
          title="No events here"
          message={hasFilters ? 'Try another search or status.' : 'Create your first event to get started.'}
          action={!hasFilters && <Link to="/organizer/events/new" className="button button--primary">New event</Link>}
        />
      )}
      {events.data && events.data.data.length > 0 && (
        <>
          <TableWrap label="Your events" busy={events.isFetching}>
            <table className="table">
              <thead>
                <tr>
                  <th scope="col">Event</th>
                  {isAdmin && <th scope="col">Organizer</th>}
                  <th scope="col">Status</th>
                  <th scope="col" className="table__number">Registered</th>
                  <th scope="col" className="table__number">Waitlist</th>
                </tr>
              </thead>
              <tbody>
                {events.data.data.map((event) => (
                  <tr key={event.id}>
                    <td>
                      <Link to={`/organizer/events/${event.id}`} className="table__primary">
                        {event.title}
                      </Link>
                      <span className="table__secondary">{formatEventTime(event.startsAt, event.endsAt)}</span>
                    </td>
                    {isAdmin && <td>{event.organizer.name}</td>}
                    <td>
                      <Badge tone={EVENT_STATUS[event.status].tone}>{EVENT_STATUS[event.status].label}</Badge>
                      {event.isPast && <span className="table__secondary">Ended</span>}
                    </td>
                    <td className="table__number">
                      {event.confirmedCount} / {event.capacity}
                    </td>
                    <td className="table__number">{event.waitlistCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
          <Pagination pagination={events.data.pagination} onPageChange={(next) => setFilter({ page: String(next) })} />
        </>
      )}
    </>
  );
}
