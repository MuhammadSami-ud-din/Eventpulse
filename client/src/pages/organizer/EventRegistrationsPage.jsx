import { useState } from 'react';
import { exportRegistrationsCsv, fetchEventRegistrations, markAttendance, markRemainingNoShows } from '../../api/organizer.js';
import { Badge } from '../../components/Badge.jsx';
import { ManagedEventGate } from '../../components/ManagedEventGate.jsx';
import { OrganizerEventHeader } from '../../components/OrganizerEventHeader.jsx';
import { Pagination } from '../../components/Pagination.jsx';
import { TableSkeleton } from '../../components/Skeletons.jsx';
import { EmptyState, ErrorState } from '../../components/StateViews.jsx';
import { TableWrap } from '../../components/TableWrap.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { useAsync } from '../../hooks/useAsync.js';
import { useDebouncedValue } from '../../hooks/useDebouncedValue.js';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import { downloadFile } from '../../utils/download.js';
import { errorMessage } from '../../utils/errors.js';
import { ATTENDANCE_STATUS, hasEventStarted, REGISTRATION_STATUS } from '../../utils/eventStatus.js';
import { formatDateTime } from '../../utils/format.js';

const PAGE_SIZE = 25;
const STATUS_FILTERS = [
  ['', 'All'],
  ['confirmed', 'Confirmed'],
  ['waitlisted', 'Waitlisted'],
  ['cancelled', 'Cancelled'],
];

// Content-Disposition may or may not quote the file name.
function fileNameFrom(response, fallback) {
  const match = response.headers['content-disposition']?.match(/filename="?([^";]+)"?/);
  return match?.[1] ?? fallback;
}

function AttendanceCell({ registration, canMark, onMark }) {
  const { attendance } = registration;
  return (
    <div className="attendance-cell">
      {attendance && <Badge tone={ATTENDANCE_STATUS[attendance.status].tone}>{ATTENDANCE_STATUS[attendance.status].label}</Badge>}
      {canMark && registration.status === 'confirmed' && (
        <div className="attendance-cell__actions">
          {attendance?.status !== 'attended' && (
            <button type="button" className="button button--small" onClick={() => onMark(registration, 'attended')}>
              Mark attended
            </button>
          )}
          {attendance?.status !== 'no_show' && (
            <button type="button" className="button button--small" onClick={() => onMark(registration, 'no_show')}>
              Mark no-show
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function RegistrationsTable({ event }) {
  useDocumentTitle(`Registrations · ${event.title}`);
  const { showToast } = useToast();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [exporting, setExporting] = useState(false);
  const q = useDebouncedValue(search.trim());
  const started = hasEventStarted(event);

  const list = useAsync(
    (signal) =>
      fetchEventRegistrations(event.id, { q: q || undefined, status: status || undefined, page, pageSize: PAGE_SIZE }, { signal }),
    [event.id, q, status, page],
  );

  async function handleExport() {
    setExporting(true);
    try {
      const response = await exportRegistrationsCsv(event.id);
      downloadFile(response.data, fileNameFrom(response, 'registrations.csv'), 'text/csv;charset=utf-8');
    } catch (error) {
      showToast({ type: 'error', message: errorMessage(error) });
    } finally {
      setExporting(false);
    }
  }

  async function handleMark(registration, attendanceStatus) {
    try {
      await markAttendance(event.id, registration.id, attendanceStatus);
      list.reload();
    } catch (error) {
      showToast({ type: 'error', message: errorMessage(error) });
    }
  }

  async function handleRemainingNoShows() {
    try {
      const count = await markRemainingNoShows(event.id);
      showToast({ type: 'success', message: `${count} student(s) marked as no-show.` });
      list.reload();
    } catch (error) {
      showToast({ type: 'error', message: errorMessage(error) });
    }
  }

  const counts = list.data?.counts;
  return (
    <>
      <div className="toolbar">
        <div className="field field--inline">
          <label htmlFor="registration-search" className="field__label">
            Search
          </label>
          <input
            id="registration-search"
            type="search"
            className="field__control"
            placeholder="Name, email or student number"
            maxLength={100}
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </div>
        <div className="field field--inline">
          <label htmlFor="registration-status" className="field__label">
            Status
          </label>
          <select
            id="registration-status"
            className="field__control"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
          >
            {STATUS_FILTERS.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div className="toolbar__actions">
          <button type="button" className="button" onClick={handleExport} disabled={exporting}>
            {exporting ? 'Exporting…' : 'Export CSV'}
          </button>
          {event.isPast && (
            <button type="button" className="button" onClick={handleRemainingNoShows}>
              Mark remaining as no-shows
            </button>
          )}
        </div>
      </div>

      {counts && (
        <p className="results-count" role="status">
          {counts.confirmed} confirmed · {counts.waitlisted} waitlisted · {counts.cancelled} cancelled
        </p>
      )}
      {list.isLoading && <TableSkeleton label="Loading registrations…" columns={5} />}
      {list.error && <ErrorState error={list.error} onRetry={list.reload} />}
      {list.data && list.data.data.length === 0 && (
        <EmptyState title="No registrations found" message={q || status ? 'Try another search or filter.' : 'Nobody has registered yet.'} />
      )}
      {list.data && list.data.data.length > 0 && (
        <>
          <TableWrap label="Registrations" busy={list.isFetching}>
            <table className="table">
              <thead>
                <tr>
                  <th scope="col">Student</th>
                  <th scope="col">Student no.</th>
                  <th scope="col">Status</th>
                  <th scope="col">Registered</th>
                  <th scope="col">Attendance</th>
                </tr>
              </thead>
              <tbody>
                {list.data.data.map((registration) => (
                  <tr key={registration.id}>
                    <td>
                      <span className="table__primary">{registration.student.fullName}</span>
                      <span className="table__secondary">{registration.student.email}</span>
                    </td>
                    <td>{registration.student.studentNumber ?? '—'}</td>
                    <td>
                      <Badge tone={REGISTRATION_STATUS[registration.status].tone}>
                        {registration.status === 'waitlisted'
                          ? `Waitlist #${registration.waitlistPosition}`
                          : REGISTRATION_STATUS[registration.status].label}
                      </Badge>
                    </td>
                    <td>{formatDateTime(registration.registeredAt)}</td>
                    <td>
                      <AttendanceCell registration={registration} canMark={started} onMark={handleMark} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
          <Pagination pagination={list.data.pagination} onPageChange={setPage} />
        </>
      )}
    </>
  );
}

export function EventRegistrationsPage() {
  return (
    <ManagedEventGate>
      {(event) => (
        <>
          <OrganizerEventHeader event={event} />
          <RegistrationsTable event={event} />
        </>
      )}
    </ManagedEventGate>
  );
}
