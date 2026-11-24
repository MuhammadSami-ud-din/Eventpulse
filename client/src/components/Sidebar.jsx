import { useEffect, useId, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router';
import { useAuth } from '../context/AuthContext.jsx';
import { useNotifications } from '../context/NotificationsContext.jsx';
import { isActivePath, navigationFor } from '../utils/navigation.js';
import { Avatar } from './Avatar.jsx';
import { Icon } from './Icon.jsx';

const ROLE_LABELS = { student: 'Student', organizer: 'Organizer', admin: 'Admin' };

// Up/Down (and Home/End) move between the links, on top of normal Tab order.
// Every link stays in the Tab order too, so nothing here can trap focus.
function moveFocusWithArrows(e) {
  const steps = { ArrowDown: 1, ArrowUp: -1 };
  if (!(e.key in steps) && e.key !== 'Home' && e.key !== 'End') return;
  const links = [...e.currentTarget.querySelectorAll('.sidenav__link')];
  const index = links.indexOf(document.activeElement);
  if (index === -1) return;
  e.preventDefault();
  let next = (index + (steps[e.key] ?? 0) + links.length) % links.length;
  if (e.key === 'Home') next = 0;
  if (e.key === 'End') next = links.length - 1;
  links[next].focus();
}

function Navigation({ collapsed, onNavigate }) {
  const { user } = useAuth();
  const { unreadCount } = useNotifications();
  const { pathname } = useLocation();

  return (
    <nav className="sidenav" aria-label="Main" onKeyDown={moveFocusWithArrows}>
      {navigationFor(user).map((group) => (
        <div key={group.id} className="sidenav__group">
          <p className="sidenav__heading" id={`nav-${group.id}`}>
            {group.label}
          </p>
          <ul className="sidenav__list" aria-labelledby={`nav-${group.id}`}>
            {group.items.map((item) => {
              const badge = item.badge === 'unread' && unreadCount > 0 ? unreadCount : null;
              return (
                <li key={item.to}>
                  <Link
                    to={item.to}
                    className="sidenav__link"
                    aria-current={isActivePath(item, pathname) ? 'page' : undefined}
                    data-tip={collapsed ? item.label : undefined}
                    onClick={onNavigate}
                  >
                    <Icon name={item.icon} />
                    <span className="sidenav__label">{item.label}</span>
                    {badge && (
                      <span className="sidenav__badge">
                        {badge}
                        <span className="visually-hidden"> unread</span>
                      </span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

// The signed-in user's card, with a small menu. Escape or a click elsewhere
// closes the menu, and Escape puts focus back on the button.
function AccountMenu({ onShowShortcuts, onLogout, onNavigate }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const buttonRef = useRef(null);
  const wrapperRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const closeOnOutsideClick = (e) => {
      if (!wrapperRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('pointerdown', closeOnOutsideClick);
    return () => document.removeEventListener('pointerdown', closeOnOutsideClick);
  }, [open]);

  function closeWithEscape(e) {
    if (e.key !== 'Escape' || !open) return;
    // Handled here, so a drawer around the menu does not close as well.
    e.stopPropagation();
    e.preventDefault();
    setOpen(false);
    buttonRef.current.focus();
  }

  // `action` is optional: on desktop there is no drawer to close after navigating.
  const choose = (action) => () => {
    setOpen(false);
    action?.();
  };

  return (
    <div className="account" ref={wrapperRef} onKeyDown={closeWithEscape}>
      {open && (
        <ul id={menuId} className="account__menu">
          <li>
            <Link to="/profile" className="account__item" onClick={choose(onNavigate)}>
              <Icon name="user" /> Profile
            </Link>
          </li>
          <li>
            <button type="button" className="account__item" onClick={choose(onShowShortcuts)}>
              <Icon name="keyboard" /> Keyboard shortcuts
            </button>
          </li>
          <li>
            <button type="button" className="account__item" onClick={choose(onLogout)}>
              <Icon name="logout" /> Log out
            </button>
          </li>
        </ul>
      )}
      <button
        ref={buttonRef}
        type="button"
        className="account__button"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => setOpen((current) => !current)}
      >
        <Avatar user={user} size={36} />
        <span className="account__text">
          <span className="account__name">{user.fullName}</span>
          <span className="account__role">{ROLE_LABELS[user.role]}</span>
        </span>
        <span className="visually-hidden">Account menu</span>
      </button>
    </div>
  );
}

// Everything inside the sidebar; the mobile drawer shows the same content.
export function SidebarContent({ collapsed = false, onToggleCollapse, onNavigate, theme, onToggleTheme, onShowShortcuts, onLogout, onClose }) {
  const { user } = useAuth();
  const location = useLocation();

  return (
    <>
      <div className="sidebar__top">
        <Link to="/" className="brand" onClick={onNavigate}>
          <span className="brand__mark" aria-hidden="true" />
          <span className="brand__name">EventPulse</span>
        </Link>
        {onClose && (
          <button type="button" className="icon-button" onClick={onClose} aria-label="Close menu">
            <Icon name="close" />
          </button>
        )}
      </div>

      <Navigation collapsed={collapsed} onNavigate={onNavigate} />

      <div className="sidebar__bottom">
        <div className="sidebar__tools">
          <button type="button" className="icon-button" aria-pressed={theme === 'dark'} onClick={onToggleTheme} data-tip={collapsed ? 'Dark theme' : undefined}>
            <Icon name={theme === 'dark' ? 'sun' : 'moon'} />
            <span className="visually-hidden">Dark theme</span>
          </button>
          {onToggleCollapse && (
            <button
              type="button"
              className="icon-button sidebar__collapse"
              aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              onClick={onToggleCollapse}
            >
              <Icon name={collapsed ? 'chevronRight' : 'chevronLeft'} />
            </button>
          )}
        </div>
        {user ? (
          <AccountMenu onShowShortcuts={onShowShortcuts} onLogout={onLogout} onNavigate={onNavigate} />
        ) : collapsed ? (
          <div className="sidebar__guest">
            <Link to="/login" state={{ from: location }} className="icon-button" data-tip="Log in" onClick={onNavigate}>
              <Icon name="user" />
              <span className="visually-hidden">Log in</span>
            </Link>
          </div>
        ) : (
          <div className="sidebar__guest">
            <Link to="/login" state={{ from: location }} className="button button--block" onClick={onNavigate}>
              Log in
            </Link>
            <Link to="/register" className="button button--primary button--block" onClick={onNavigate}>
              Sign up
            </Link>
          </div>
        )}
      </div>
    </>
  );
}
