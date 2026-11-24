import { useEffect } from 'react';

// Calls `callback` every `intervalMs` while the tab is visible, and once
// immediately when the tab becomes visible again.
export function usePolling(callback, intervalMs, enabled = true) {
  useEffect(() => {
    if (!enabled) return undefined;
    const tick = () => {
      if (document.visibilityState === 'visible') callback();
    };
    const timer = setInterval(tick, intervalMs);
    document.addEventListener('visibilitychange', tick);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', tick);
    };
  }, [callback, intervalMs, enabled]);
}
