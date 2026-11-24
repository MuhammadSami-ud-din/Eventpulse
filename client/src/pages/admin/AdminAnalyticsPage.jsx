import { Link } from 'react-router';
import { fetchAnalytics } from '../../api/admin.js';
import { AttendanceBar } from '../../components/AttendanceBar.jsx';
import { CategoryDemand } from '../../components/CategoryDemand.jsx';
import { ColumnChart } from '../../components/ColumnChart.jsx';
import { DashboardSkeleton } from '../../components/Skeletons.jsx';
import { ErrorState } from '../../components/StateViews.jsx';
import { StatTile } from '../../components/StatTile.jsx';
import { TableWrap } from '../../components/TableWrap.jsx';
import { useAsync } from '../../hooks/useAsync.js';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import { formatDate, formatMonth, formatRate, formatShortMonth, pluralize } from '../../utils/format.js';

function TopEventsTable({ events }) {
  if (events.length === 0) return <p className="chart__empty">No upcoming published events.</p>;
  return (
    <TableWrap label="Most in-demand upcoming events">
      <table className="table">
        <caption className="table__caption">Most in-demand upcoming events</caption>
        <thead>
          <tr>
            <th scope="col">Event</th>
            <th scope="col">Starts</th>
            <th scope="col" className="table__number">
              Seats taken
            </th>
            <th scope="col" className="table__number">
              Waitlist
            </th>
          </tr>
        </thead>
        <tbody>
          {events.map((event) => (
            <tr key={event.id}>
              <td>
                <Link to={`/organizer/events/${event.id}`}>{event.title}</Link>
              </td>
              <td>{formatDate(event.startsAt)}</td>
              <td className="table__number">
                {event.confirmed} / {event.capacity}
              </td>
              <td className="table__number">{event.waitlisted}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </TableWrap>
  );
}

export function AdminAnalyticsPage() {
  useDocumentTitle('Analytics');
  const { data, error, isLoading, reload } = useAsync((signal) => fetchAnalytics({ signal }), []);

  return (
    <>
      <h1>Analytics</h1>
      {isLoading && <DashboardSkeleton label="Loading analytics…" />}
      {error && <ErrorState error={error} onRetry={reload} />}
      {data && <AnalyticsReport data={data} />}
    </>
  );
}

function AnalyticsReport({ data }) {
  const { users, events, registrations, attendance } = data;
  const months = data.registrationsByMonth.map((entry) => ({
    key: entry.month,
    label: formatMonth(entry.month),
    tick: formatShortMonth(entry.month),
    count: entry.count,
  }));
  const pastConfirmed = attendance.attended + attendance.noShows + attendance.notMarked;

  return (
    <>
      <section aria-labelledby="people-heading" className="manage-section">
        <h2 id="people-heading">At a glance</h2>
        <div className="stat-grid">
          <StatTile
            label="Students"
            value={users.students}
            detail={users.disabled > 0 ? `${pluralize(users.disabled, 'disabled account')} not counted` : undefined}
          />
          <StatTile label="Organizers" value={users.organizers} detail={pluralize(users.admins, 'admin')} />
          <StatTile label="Live events" value={events.published} detail={`${events.closed} closed`} />
          <StatTile
            label="Awaiting approval"
            value={events.pending}
            detail={events.pending > 0 ? <Link to="/admin">Review now</Link> : 'Nothing to review'}
          />
          <StatTile label="Seats taken" value={registrations.confirmed} detail={`${registrations.waitlisted} waitlisted`} />
          <StatTile label="Attendance rate" value={formatRate(attendance.attendanceRate)} detail="at past events, of students marked" />
        </div>
      </section>

      <section aria-labelledby="trends-heading" className="manage-section">
        <h2 id="trends-heading">Registrations and demand</h2>
        <div className="chart-grid">
          <div className="card">
            <ColumnChart
              title="New registrations per month"
              columns={months}
              columnHeading="Month"
              unit="registration"
              emptyMessage="No registrations in the last six months."
            />
          </div>
          <div className="card">
            <CategoryDemand categories={data.categories} />
          </div>
          <div className="card">
            <AttendanceBar
              stats={{ ...attendance, confirmed: pastConfirmed }}
              title={`Attendance at past events (${pluralize(pastConfirmed, 'confirmed seat')})`}
            />
          </div>
          <TopEventsTable events={data.topEvents} />
        </div>
      </section>
    </>
  );
}
