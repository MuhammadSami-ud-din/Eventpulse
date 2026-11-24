import { errorMessage } from '../utils/errors.js';
import { Illustration } from './Illustration.jsx';

export function Loading({ label = 'Loading…' }) {
  return (
    <div className="state" role="status">
      <span className="spinner" aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}

// `headingLevel` is 1 when the empty state is the whole page (e.g. 404),
// so every page still has exactly one main heading.
export function EmptyState({ title, message, action, icon = 'inbox', headingLevel = 2 }) {
  const Heading = `h${headingLevel}`;
  return (
    <div className="state">
      <Illustration icon={icon} />
      <Heading className="state__title">{title}</Heading>
      {message && <p className="state__message">{message}</p>}
      {action}
    </div>
  );
}

export function ErrorState({ error, onRetry }) {
  return (
    <div className="state state--error" role="alert">
      <Illustration icon="alert" tone="danger" />
      <h2 className="state__title">Something went wrong</h2>
      <p className="state__message">{errorMessage(error)}</p>
      {onRetry && (
        <button type="button" className="button" onClick={onRetry}>
          Try again
        </button>
      )}
    </div>
  );
}
