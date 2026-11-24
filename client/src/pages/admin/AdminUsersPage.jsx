import { useState } from 'react';
import { fetchUsers } from '../../api/admin.js';
import { AdminNav } from '../../components/AdminNav.jsx';
import { Badge } from '../../components/Badge.jsx';
import { Pagination } from '../../components/Pagination.jsx';
import { EmptyState, ErrorState, Loading } from '../../components/StateViews.jsx';
import { useAsync } from '../../hooks/useAsync.js';
import { useDebouncedValue } from '../../hooks/useDebouncedValue.js';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import { formatDate, pluralize } from '../../utils/format.js';

const ROLE_FILTERS = [
  ['', 'All roles'],
  ['student', 'Students'],
  ['organizer', 'Organizers'],
  ['admin', 'Admins'],
];
const ROLE_LABELS = { student: 'Student', organizer: 'Organizer', admin: 'Admin' };

export function AdminUsersPage() {
  useDocumentTitle('Users');
  const [search, setSearch] = useState('');
  const [role, setRole] = useState('');
  const [page, setPage] = useState(1);
  const q = useDebouncedValue(search.trim());

  const users = useAsync(
    (signal) => fetchUsers({ q: q || undefined, role: role || undefined, page, pageSize: 25 }, { signal }),
    [q, role, page],
  );

  return (
    <>
      <h1>Admin</h1>
      <AdminNav />
      <div className="toolbar">
        <div className="field field--inline">
          <label htmlFor="user-search" className="field__label">
            Search
          </label>
          <input
            id="user-search"
            type="search"
            className="field__control"
            placeholder="Name, email or student number"
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
      </div>

      {users.isLoading && <Loading label="Loading users…" />}
      {users.error && <ErrorState error={users.error} onRetry={users.reload} />}
      {users.data && users.data.data.length === 0 && <EmptyState title="No users found" message="Try another search." />}
      {users.data && users.data.data.length > 0 && (
        <>
          <p className="results-count" role="status">
            {pluralize(users.data.pagination.total, 'user')}
          </p>
          <div className="table-wrap" aria-busy={users.isFetching}>
            <table className="table">
              <thead>
                <tr>
                  <th scope="col">Name</th>
                  <th scope="col">Role</th>
                  <th scope="col">Student no.</th>
                  <th scope="col">Department</th>
                  <th scope="col">Status</th>
                  <th scope="col">Joined</th>
                </tr>
              </thead>
              <tbody>
                {users.data.data.map((user) => (
                  <tr key={user.id}>
                    <td>
                      <span className="table__primary">{user.fullName}</span>
                      <span className="table__secondary">{user.email}</span>
                    </td>
                    <td>{ROLE_LABELS[user.role]}</td>
                    <td>{user.studentNumber ?? '—'}</td>
                    <td>{user.department ?? '—'}</td>
                    <td>{user.isActive ? <Badge tone="success">Active</Badge> : <Badge>Disabled</Badge>}</td>
                    <td>{formatDate(user.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination pagination={users.data.pagination} onPageChange={setPage} />
        </>
      )}
    </>
  );
}
