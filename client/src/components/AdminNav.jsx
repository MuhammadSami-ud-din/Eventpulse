import { NavLink } from 'react-router';

const SECTIONS = [
  ['/admin', 'Event approvals'],
  ['/admin/users', 'Users'],
  ['/admin/categories', 'Categories'],
  ['/admin/analytics', 'Analytics'],
];

export function AdminNav() {
  return (
    <nav className="tabs" aria-label="Admin sections">
      {SECTIONS.map(([to, label]) => (
        // `end` on /admin only, so it is not also highlighted on /admin/users.
        <NavLink key={to} to={to} end={to === '/admin'} className="tabs__link">
          {label}
        </NavLink>
      ))}
    </nav>
  );
}
