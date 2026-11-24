import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate, useNavigationType } from 'react-router';
import { useAuth } from '../context/AuthContext.jsx';
import { useNotifications } from '../context/NotificationsContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { useTheme } from '../hooks/useTheme.js';

function NavItem({ to, children }) {
  return (
    <li>
      <NavLink to={to} end={to === '/'} className="nav__link">
        {children}
      </NavLink>
    </li>
  );
}

// A moon in light mode, a sun in dark mode. Purely decorative: the button's
// name stays "Dark theme" and aria-pressed says whether it is on.
function ThemeIcon({ dark }) {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      {dark ? (
        <>
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
        </>
      ) : (
        <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z" />
      )}
    </svg>
  );
}

// After following a link, start at the top of the new page and move focus to
// its content, so keyboard and screen-reader users are not left on the link
// they clicked. Back/forward keeps the browser's own position. Only the path
// counts: typing in a search box (which changes ?q=) must not move focus.
function useFocusOnNavigation(mainRef) {
  const location = useLocation();
  const navigationType = useNavigationType();
  const previousPath = useRef(location.pathname);

  useEffect(() => {
    if (previousPath.current === location.pathname) return;
    previousPath.current = location.pathname;
    if (navigationType === 'POP') return;
    window.scrollTo(0, 0);
    mainRef.current?.focus({ preventScroll: true });
  }, [location.pathname, navigationType, mainRef]);
}

export function Layout() {
  const { user, logout } = useAuth();
  const { unreadCount } = useNotifications();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const { theme, toggleTheme } = useTheme();
  const mainRef = useRef(null);
  useFocusOnNavigation(mainRef);

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
          <div className="header__tools">
            <button
              type="button"
              className="icon-button"
              aria-pressed={theme === 'dark'}
              title="Dark theme"
              onClick={toggleTheme}
            >
              <ThemeIcon dark={theme === 'dark'} />
              <span className="visually-hidden">Dark theme</span>
            </button>
            <button
              type="button"
              className="menu-toggle"
              aria-expanded={menuOpen}
              aria-controls="main-nav"
              onClick={() => setMenuOpen((open) => !open)}
            >
              Menu
            </button>
          </div>
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
      <main id="main" ref={mainRef} className="main" tabIndex={-1}>
        <Outlet />
      </main>
      <footer className="footer">EventPulse · Campus events, without the queue.</footer>
    </div>
  );
}
