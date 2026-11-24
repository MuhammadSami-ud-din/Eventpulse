import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router';
import { useAuth } from '../context/AuthContext.jsx';
import { useNotifications } from '../context/NotificationsContext.jsx';
import { useToast } from '../context/ToastContext.jsx';

function NavItem({ to, children }) {
  return (
    <li>
      <NavLink to={to} end={to === '/'} className="nav__link">
        {children}
      </NavLink>
    </li>
  );
}

export function Layout() {
  const { user, logout } = useAuth();
  const { unreadCount } = useNotifications();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  // Close the mobile menu after navigating.
  useEffect(() => setMenuOpen(false), [location.pathname]);

  async function handleLogout() {
    await logout();
    showToast({ type: 'success', message: 'You have been logged out.' });
    navigate('/');
  }

  return (
    <div className="app">
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <header className="header">
        <div className="header__inner">
          <Link to="/" className="brand">
            EventPulse
          </Link>
          <button
            type="button"
            className="menu-toggle"
            aria-expanded={menuOpen}
            aria-controls="main-nav"
            onClick={() => setMenuOpen((open) => !open)}
          >
            Menu
          </button>
          <nav id="main-nav" className={`nav ${menuOpen ? 'nav--open' : ''}`} aria-label="Main">
            <ul className="nav__list">
              <NavItem to="/">Events</NavItem>
              {user?.role === 'student' && <NavItem to="/my/registrations">My registrations</NavItem>}
              {user?.role === 'organizer' && <NavItem to="/organizer">My events</NavItem>}
              {user?.role === 'admin' && <NavItem to="/organizer">Manage events</NavItem>}
              {user?.role === 'admin' && <NavItem to="/admin">Admin</NavItem>}
              {user && (
                <NavItem to="/notifications">
                  Notifications
                  {unreadCount > 0 && (
                    <span className="nav__badge">
                      {unreadCount}
                      <span className="visually-hidden"> unread</span>
                    </span>
                  )}
                </NavItem>
              )}
              {user && <NavItem to="/profile">Profile</NavItem>}
            </ul>
            <div className="nav__account">
              {user ? (
                <button type="button" className="button button--ghost" onClick={handleLogout}>
                  Log out
                </button>
              ) : (
                <>
                  <Link to="/login" state={{ from: location }} className="button button--ghost">
                    Log in
                  </Link>
                  <Link to="/register" className="button button--primary">
                    Sign up
                  </Link>
                </>
              )}
            </div>
          </nav>
        </div>
      </header>
      <main id="main" className="main" tabIndex={-1}>
        <Outlet />
      </main>
      <footer className="footer">EventPulse · Campus events, without the queue.</footer>
    </div>
  );
}
