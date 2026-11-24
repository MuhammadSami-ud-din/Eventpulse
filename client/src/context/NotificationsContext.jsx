import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { fetchUnreadCount } from '../api/notifications.js';
import { useAuth } from './AuthContext.jsx';

const NotificationsContext = createContext(null);
const POLL_INTERVAL_MS = 60 * 1000;

// Holds the unread badge count so the header and the notifications page agree.
export function NotificationsProvider({ children }) {
  const { user } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);

  const refreshUnreadCount = useCallback(() => {
    fetchUnreadCount()
      .then(setUnreadCount)
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!user) {
      setUnreadCount(0);
      return undefined;
    }
    refreshUnreadCount();
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') refreshUnreadCount();
    }, POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [user, refreshUnreadCount]);

  const value = useMemo(
    () => ({ unreadCount, setUnreadCount, refreshUnreadCount }),
    [unreadCount, refreshUnreadCount],
  );
  return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>;
}

export function useNotifications() {
  const context = useContext(NotificationsContext);
  if (!context) throw new Error('useNotifications must be used inside <NotificationsProvider>');
  return context;
}
