const TEXT_INPUT_TYPES = new Set(['text', 'search', 'email', 'password', 'number', 'tel', 'url', 'date', 'datetime-local', 'time']);

// True when a key press is meant as typing, so single-key shortcuts
// ("/" and "?") must leave it alone.
export function isTypingTarget(element) {
  if (!element) return false;
  if (element.isContentEditable) return true;
  const tag = element.tagName;
  if (tag === 'TEXTAREA' || tag === 'SELECT') return true;
  return tag === 'INPUT' && TEXT_INPUT_TYPES.has((element.type || 'text').toLowerCase());
}

// Maps a keydown event to a shortcut name, or null.
// Ctrl/Cmd+K works everywhere, even while typing; "/" and "?" do not.
export function shortcutFor(event) {
  if ((event.ctrlKey || event.metaKey) && !event.altKey && event.key.toLowerCase() === 'k') return 'palette';
  if (event.ctrlKey || event.metaKey || event.altKey || isTypingTarget(event.target)) return null;
  if (event.key === '/') return 'search';
  if (event.key === '?') return 'help';
  return null;
}
