import { NavLink } from 'react-router';

export function AdminNav() {
  return (
    <nav className="tabs" aria-label="Admin sections">
      <NavLink to="/admin" end className="tabs__link">
        Event approvals
      </NavLink>
      <NavLink to="/admin/users" className="tabs__link">
        Users
      </NavLink>
    </nav>
  );
}
