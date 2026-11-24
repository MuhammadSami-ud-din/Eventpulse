import { renderMarkdown } from '../utils/markdown.js';

// Formatted text from the safe Markdown subset (see utils/markdown.js).
export function Markdown({ text, className = '' }) {
  return <div className={`prose ${className}`}>{renderMarkdown(text)}</div>;
}
