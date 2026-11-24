import { useState } from 'react';
import { Link } from 'react-router';
import { fetchNotifications, markAllNotificationsRead, markNotificationRead } from '../api/notifications.js';
import { Pagination } from '../components/Pagination.jsx';
import { TableSkeleton } from '../components/Skeletons.jsx';
import { EmptyState, ErrorState } from '../components/StateViews.jsx';
import { useNotifications } from '../context/NotificationsContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { useAsync } from '../hooks/useAsync.js';
import { useDocumentTitle } from '../hooks/useDocumentTitle.js';
import { errorMessage } from '../utils/errors.js';
import { formatDateTime } from '../utils/format.js';

export function NotificationsPage() {
  useDocumentTitle('Notifications');
  const [page, setPage] = useState(1);
  const { setUnreadCount } = useNotifications();
  const { showToast } = useToast();
  const { data, error, isLoading, reload, setData } = useAsync(
    (signal) =>
      fetchNotifications({ page }, { signal }).then((result) => {
        setUnreadCount(result.unreadCount);
        return result;
      }),
    [page],
  );

  // Updates the item in place instead of refetching the whole page.
  async function markRead(notification) {
    try {
      const unreadCount = await markNotificationRead(notification.id);
      setUnreadCount(unreadCount);
      setData({
        ...data,
        data: data.data.map((n) => (n.id === notification.id ? { ...n, readAt: new Date().toISOString() } : n)),
      });
    } catch (markError) {
      showToast({ type: 'error', message: errorMessage(markError) });
    }
  }

  async function markAll() {
    try {
      setUnreadCount(await markAllNotificationsRead());
      reload();
    } catch (markError) {
      showToast({ type: 'error', message: errorMessage(markError) });
    }
  }

  if (isLoading) return <TableSkeleton label="Loading notifications…" rows={5} columns={1} />;
  if (error) return <ErrorState error={error} onRetry={reload} />;

  return (
    <>
      <div className="page-header">
        <h1>Notifications</h1>
        {data.unreadCount > 0 && (
          <button type="button" className="button" onClick={markAll}>
            Mark all as read
          </button>
        )}
      </div>
      {data.data.length === 0 ? (
        <EmptyState icon="bell" title="No notifications yet" message="Registration updates and waitlist news will appear here." />
      ) : (
        <ul className="notification-list">
          {data.data.map((notification) => {
            const unread = !notification.readAt;
            return (
              <li key={notification.id} className={`card notification ${unread ? 'notification--unread' : ''}`}>
                <div className="notification__body">
                  <h2 className="notification__title">
                    {unread && <span className="visually-hidden">Unread: </span>}
                    {notification.title}
                  </h2>
                  <p>{notification.message}</p>
                  <time className="notification__time" dateTime={notification.createdAt}>
                    {formatDateTime(notification.createdAt)}
                  </time>
                </div>
                <div className="notification__actions">
                  {notification.eventId && (
                    <Link to={`/events/${notification.eventId}`} className="button button--ghost" onClick={() => unread && markRead(notification)}>
                      View event
                    </Link>
                  )}
                  {unread && (
                    <button type="button" className="button button--ghost" onClick={() => markRead(notification)}>
                      Mark as read
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <Pagination pagination={data.pagination} onPageChange={setPage} />
    </>
  );
}
