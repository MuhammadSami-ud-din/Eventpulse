// Runs before the page renders (a plain, blocking script in <head>), so the
// first paint already uses the right theme: no white flash at night.
// A choice saved with the header toggle wins; otherwise the system setting
// applies, and is followed live if it changes. The key is shared with
// src/hooks/useTheme.js.
(() => {
  const STORAGE_KEY = 'eventpulse-theme';
  const systemDark = window.matchMedia('(prefers-color-scheme: dark)');

  // Storage can throw (blocked cookies, some private modes): fall back to the system.
  function savedTheme() {
    try {
      const value = localStorage.getItem(STORAGE_KEY);
      return value === 'light' || value === 'dark' ? value : null;
    } catch {
      return null;
    }
  }

  function applyTheme() {
    document.documentElement.dataset.theme = savedTheme() ?? (systemDark.matches ? 'dark' : 'light');
  }

  applyTheme();
  systemDark.addEventListener('change', applyTheme);
})();
