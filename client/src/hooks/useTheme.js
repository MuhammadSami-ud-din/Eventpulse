import { useCallback, useEffect, useState } from 'react';

// Shared with public/theme-init.js, which applies the theme before React starts.
const STORAGE_KEY = 'eventpulse-theme';
const root = document.documentElement;

// The current theme ('light' or 'dark') and a toggle that remembers the choice.
export function useTheme() {
  const [theme, setTheme] = useState(() => root.dataset.theme ?? 'light');

  // theme-init.js may switch the theme when the system setting changes, so
  // the attribute on <html> is the source of truth, not this state.
  useEffect(() => {
    const observer = new MutationObserver(() => setTheme(root.dataset.theme));
    observer.observe(root, { attributes: true, attributeFilter: ['data-theme'] });
    return () => observer.disconnect();
  }, []);

  const toggleTheme = useCallback(() => {
    const next = root.dataset.theme === 'dark' ? 'light' : 'dark';
    root.dataset.theme = next;
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Not saved (storage blocked); the theme still changes for this visit.
    }
  }, []);

  return { theme, toggleTheme };
}
