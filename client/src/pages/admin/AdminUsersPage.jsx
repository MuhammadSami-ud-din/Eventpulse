import { useState } from 'react';
import { Link } from 'react-router';
import { changeUserRole, fetchUsers, setUserActive } from '../../api/admin.js';
import { Badge } from '../../components/Badge.jsx';
import { ConfirmDialog } from '../../components/ConfirmDialog.jsx';
import { Pagination } from '../../components/Pagination.jsx';
import { TableSkeleton } from '../../components/Skeletons.jsx';
import { EmptyState, ErrorState } from '../../components/StateViews.jsx';
import { TableWrap } from '../../components/TableWrap.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { useAsync } from '../../hooks/useAsync.js';
import { useDebouncedValue } from '../../hooks/useDebouncedValue.js';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import { errorMessage } from '../../utils/errors.js';
import { formatDate, pluralize } from '../../utils/format.js';

const ROLE_FILTERS = [
  ['', 'All roles'],
  ['student', 'Students'],
  ['organizer', 'Organizers'],
  ['admin', 'Admins'],
];
const ROLE_LABELS = { student: 'Student', organizer: 'Organizer', admin: 'Admin' };
const ROLE_POWERS = {
  student: 'register for events',
  organizer: 'create and run their own events',
  admin: 'manage every event, user and category',
};

function confirmationFor(change) {
  const name = change.user.fullName;
  if (change.kind === 'role') {
    return {
      title: `Make ${name} ${change.role === 'admin' ? 'an' : 'a'} ${ROLE_LABELS[change.role].toLowerCase()}?`,
      message: `They will be able to ${ROLE_POWERS[change.role]}, starting with their next click.`,
      confirmLabel: 'Change role',
    };
  }
  return {
    title: `Disable ${name}'s account?`,
    message:
      "They are logged out everywhere and can't log in until you enable the account again. Their seats and waitlist places in events that haven't started go to the next students in line, and enabling the account later does not give them back.",
    confirmLabel: 'Disable account',
  };
}

export function AdminUsersPage() {
  useDocumentTitle('Users');
  const { user: currentUser } = useAuth();
  const { showToast } = useToast();
  const [search, setSearch] = useState('');
  const [role, setRole] = useState('');
  const [page, setPage] = useState(1);
  // { kind: 'role' | 'disable', user, role? } while a confirmation dialog is open.
  const [change, setChange] = useState(null);
  const [busy, setBusy] = useState(false);
  const q = useDebouncedValue(search.trim());

  const users = useAsync(
    (signal) => fetchUsers({ q: q || undefined, role: role || undefined, page, pageSize: 25 }, { signal }),
    [q, role, page],
  );

  async function run(action, successMessage) {
    setBusy(true);
    try {
      const result = await action();
      showToast({ type: 'success', message: successMessage(result) });
      users.reload();
    } catch (error) {
      showToast({ type: 'error', message: errorMessage(error) });
    } finally {
      // Closed either way: there is nothing typed in it to keep, and the
      // toast explains a refusal (e.g. the student still holds tickets).
      setChange(null);
      setBusy(false);
    }
  }

  function confirmChange() {
    const { user } = change;
    if (change.kind === 'role') {
      run(
        () => changeUserRole(user.id, change.role),
        () => `${user.fullName} is now ${change.role === 'admin' ? 'an' : 'a'} ${ROLE_LABELS[change.role].toLowerCase()}.`,
      );
    } else {
      run(
        () => setUserActive(user.id, false),
        ({ releasedRegistrations }) =>
          releasedRegistrations > 0
            ? `Account disabled. ${pluralize(releasedRegistrations, 'registration')} released to the waitlist.`
            : 'Account disabled.',
      );
    }
  }

  // Enabling takes nothing away, so it needs no confirmation.
  function enable(user) {
    run(() => setUserActive(user.id, true), () => `${user.fullName} can log in again.`);
  }

  const dialog = change ? confirmationFor(change) : null;

  return (
    <>
      <h1>Users</h1>
      <div className="toolbar">
        <div className="field field--inline">
          <label htmlFor="user-search" className="field__label">
            Search
          </label>
          <input
            id="user-search"
            data-shortcut="search"
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
          <label htmlFor="user-role" className="field__label">
            Role
          </label>
          <select
            id="user-role"
            className="field__control"
            value={role}
            onChange={(e) => {
              setRole(e.target.value);
              setPage(1);
            }}
          >
            {ROLE_FILTERS.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div className="toolbar__actions">
          <Link to="/admin/users/new" className="button button--primary">
            New organizer or admin
          </Link>
        </div>
      </div>

      {users.isLoading && <TableSkeleton label="Loading users…" columns={6} />}
      {users.error && <ErrorState error={users.error} onRetry={users.reload} />}
      {users.data && users.data.data.length === 0 && <EmptyState icon="users" title="No users found" message="Try another search." />}
      {users.data && users.data.data.length > 0 && (
        <>
          <p className="results-count" role="status">
            {pluralize(users.data.pagination.total, 'user')}
          </p>
          <TableWrap label="Users" busy={users.isFetching}>
            <table className="table">
              <thead>
                <tr>
                  <th scope="col">Name</th>
                  <th scope="col">Role</th>
                  <th scope="col">Student no.</th>
                  <th scope="col">Department</th>
                  <th scope="col">Status</th>
                  <th scope="col">Joined</th>
                  <th scope="col">
                    <span className="visually-hidden">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {users.data.data.map((user) => {
                  const isSelf = user.id === currentUser.id;
                  return (
                    <tr key={user.id}>
                      <td>
                        <span className="table__primary">
                          {user.fullName}
                          {isSelf && ' (you)'}
                        </span>
                        <span className="table__secondary">{user.email}</span>
                      </td>
                      <td>
                        {isSelf ? (
                          ROLE_LABELS[user.role]
                        ) : (
                          // Controlled by the saved role: picking another one only opens
                          // the confirmation, and cancelling leaves the select unchanged.
                          <select
                            className="field__control field__control--compact"
                            aria-label={`Role for ${user.fullName}`}
                            value={user.role}
                            disabled={busy}
                            onChange={(e) => setChange({ kind: 'role', user, role: e.target.value })}
                          >
                            {Object.entries(ROLE_LABELS).map(([value, label]) => (
                              <option key={value} value={value}>
                                {label}
                              </option>
                            ))}
                          </select>
                        )}
                      </td>
                      <td>{user.studentNumber ?? '—'}</td>
                      <td>{user.department ?? '—'}</td>
                      <td>{user.isActive ? <Badge tone="success">Active</Badge> : <Badge>Disabled</Badge>}</td>
                      <td>{formatDate(user.createdAt)}</td>
                      <td>
                        {!isSelf &&
                          (user.isActive ? (
                            <button
                              type="button"
                              className="button button--small button--danger-outline"
                              disabled={busy}
                              onClick={() => setChange({ kind: 'disable', user })}
                            >
                              Disable
                            </button>
                          ) : (
                            <button type="button" className="button button--small" disabled={busy} onClick={() => enable(user)}>
                              Enable
                            </button>
                          ))}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </TableWrap>
          <Pagination pagination={users.data.pagination} onPageChange={setPage} />
        </>
      )}

      <ConfirmDialog
        open={Boolean(change)}
        title={dialog?.title ?? ''}
        message={dialog?.message ?? ''}
        confirmLabel={dialog?.confirmLabel ?? ''}
        cancelLabel="Cancel"
        onConfirm={confirmChange}
        onCancel={() => setChange(null)}
        busy={busy}
      />
    </>
  );
}
