import { useCallback, useState } from 'react';

// A true/false preference remembered in this browser (e.g. a collapsed
// sidebar). Storage can be blocked, so every access is guarded and the flag
// still works for the current visit without it.
export function useStoredFlag(key, initial) {
  const [value, setValue] = useState(() => {
    try {
      const stored = localStorage.getItem(key);
      return stored === null ? initial : stored === 'true';
    } catch {
      return initial;
    }
  });

  const toggle = useCallback(() => {
    setValue((current) => {
      try {
        localStorage.setItem(key, String(!current));
      } catch {
        // Not remembered; it still toggles for this visit.
      }
      return !current;
    });
  }, [key]);

  return [value, toggle];
}
