import { Link } from 'react-router';
import { EmptyState } from '../components/StateViews.jsx';
import { useDocumentTitle } from '../hooks/useDocumentTitle.js';

export function NotFoundPage() {
  useDocumentTitle('Page not found');
  return (
    <EmptyState
      title="Page not found"
      message="The page you’re looking for doesn’t exist."
      action={<Link to="/" className="button button--primary">Back to events</Link>}
    />
  );
}
