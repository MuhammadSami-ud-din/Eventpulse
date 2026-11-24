import { Navigate, useLocation } from 'react-router';
import { useAuth } from '../context/AuthContext.jsx';
import { EmptyState, Loading } from './StateViews.jsx';

// Hides pages from the wrong users. This is for convenience only: the server
// checks the role on every request regardless of what the UI shows.
export function ProtectedRoute({ roles, children }) {
  const { user, isReady } = useAuth();
  const location = useLocation();

  if (!isReady) return <Loading label="Checking your session…" />;
  // `from` is a location object, not a URL, so it cannot redirect off-site.
  if (!user) return <Navigate to="/login" replace state={{ from: location }} />;
  if (roles && !roles.includes(user.role)) {
    return <EmptyState icon="alert" title="Not available" message="This page isn't available for your account type." />;
  }
  return children;
}
