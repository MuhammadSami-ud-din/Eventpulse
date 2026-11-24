import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, Outlet, useLocation, useNavigate, useNavigationType } from 'react-router';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { useStoredFlag } from '../hooks/useStoredFlag.js';
import { useTheme } from '../hooks/useTheme.js';
import { commandsFor } from '../utils/commands.js';
import { shortcutFor } from '../utils/shortcuts.js';
import { CommandPalette } from './CommandPalette.jsx';
import { Icon } from './Icon.jsx';
import { Modal } from './Modal.jsx';
import { ShortcutsDialog } from './ShortcutsDialog.jsx';
import { SidebarContent } from './Sidebar.jsx';

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.userAgent);

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

// Ctrl/Cmd+K, "/" and "?" for the whole app. While a dialog is open the
// single-key shortcuts stay quiet, and Ctrl/Cmd+K only closes the palette.
function useGlobalShortcuts({ togglePalette, openPalette, openHelp }) {
  useEffect(() => {
    function handleKeyDown(e) {
      const shortcut = shortcutFor(e);
      if (!shortcut) return;
      const openDialog = document.querySelector('dialog[open]');
      if (openDialog && !(shortcut === 'palette' && openDialog.classList.contains('modal--palette'))) return;
      e.preventDefault();
      if (shortcut === 'palette') togglePalette();
      if (shortcut === 'help') openHelp();
      if (shortcut === 'search') {
        const searchBox = document.querySelector('[data-shortcut="search"]');
        if (searchBox) searchBox.focus();
        else openPalette();
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [togglePalette, openPalette, openHelp]);
}

export function Layout() {
  const { user, logout } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const { theme, toggleTheme } = useTheme();
  const [collapsed, toggleCollapsed] = useStoredFlag('eventpulse-sidebar-collapsed', false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const mainRef = useRef(null);
  useFocusOnNavigation(mainRef);

  // Close the mobile drawer after navigating.
  useEffect(() => setDrawerOpen(false), [location.pathname]);

  const openPalette = useCallback(() => setPaletteOpen(true), []);
  const togglePalette = useCallback(() => setPaletteOpen((open) => !open), []);
  const openHelp = useCallback(() => setHelpOpen(true), []);
  useGlobalShortcuts({ togglePalette, openPalette, openHelp });

  const handleLogout = useCallback(async () => {
    await logout();
    showToast({ type: 'success', message: 'You have been logged out.' });
    navigate('/');
  }, [logout, showToast, navigate]);

  const commands = useMemo(() => commandsFor(user), [user]);

  function runCommand(command) {
    setPaletteOpen(false);
    if (command.to) navigate(command.to);
    if (command.id === 'action:theme') toggleTheme();
    if (command.id === 'action:shortcuts') setHelpOpen(true);
    if (command.id === 'action:logout') handleLogout();
  }

  const sidebarProps = {
    theme,
    onToggleTheme: toggleTheme,
    onShowShortcuts: openHelp,
    onLogout: handleLogout,
  };

  return (
    <div className={`shell ${collapsed ? 'shell--collapsed' : ''}`}>
      <a className="skip-link" href="#main">
        Skip to content
      </a>

      {/* A labelled landmark, so the logo, account card and buttons in it can
          be reached by landmark navigation like the rest of the page. */}
      <aside className="sidebar" aria-label="Site menu">
        <SidebarContent {...sidebarProps} collapsed={collapsed} onToggleCollapse={toggleCollapsed} />
      </aside>

      <div className="shell__body">
        <header className="topbar">
          <button
            type="button"
            className="icon-button topbar__menu"
            aria-expanded={drawerOpen}
            onClick={() => setDrawerOpen(true)}
          >
            <Icon name="menu" />
            <span className="visually-hidden">Menu</span>
          </button>
          <Link to="/" className="brand topbar__brand">
            <span className="brand__mark" aria-hidden="true" />
            <span className="brand__name">EventPulse</span>
          </Link>
          <button type="button" className="search-trigger" onClick={openPalette} aria-keyshortcuts="Control+K Meta+K">
            <Icon name="search" />
            <span className="search-trigger__label">Search or jump to…</span>
            <kbd className="kbd search-trigger__kbd">{isMac ? '⌘ K' : 'Ctrl K'}</kbd>
          </button>
          <button type="button" className="icon-button topbar__theme" aria-pressed={theme === 'dark'} onClick={toggleTheme}>
            <Icon name={theme === 'dark' ? 'sun' : 'moon'} />
            <span className="visually-hidden">Dark theme</span>
          </button>
        </header>

        <main id="main" ref={mainRef} className="main" tabIndex={-1}>
          {/* A new key per page replays the entrance animation on every navigation. */}
          <div key={location.pathname} className="page">
            <Outlet />
          </div>
        </main>
        <footer className="footer">EventPulse · Campus events, without the queue.</footer>
      </div>

      <Modal open={drawerOpen} onClose={() => setDrawerOpen(false)} label="Menu" className="modal--drawer">
        <div className="drawer">
          <SidebarContent
            {...sidebarProps}
            onShowShortcuts={() => {
              setDrawerOpen(false);
              openHelp();
            }}
            onLogout={() => {
              setDrawerOpen(false);
              handleLogout();
            }}
            onNavigate={() => setDrawerOpen(false)}
            onClose={() => setDrawerOpen(false)}
          />
        </div>
      </Modal>
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} commands={commands} onRun={runCommand} />
      <ShortcutsDialog open={helpOpen} onClose={() => setHelpOpen(false)} />
    </div>
  );
}
