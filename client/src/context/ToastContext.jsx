import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

const ToastContext = createContext(null);
// Errors stay twice as long. Not forever: a toast left on screen can cover
// the very buttons someone needs next.
const DURATION_MS = { success: 5000, info: 5000, error: 10000 };
// Older toasts make room for new ones, so a burst of errors can't fill the screen.
const MAX_TOASTS = 4;
const ICONS = { success: '✓', error: '!', info: 'i' };

// Toasts close themselves. The timer pauses while the pointer or keyboard
// focus is on a toast (WCAG 2.2.1: people need time to read), then starts over.
function Toast({ toast, onDismiss }) {
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused) return undefined;
    const timer = setTimeout(() => onDismiss(toast.id), DURATION_MS[toast.type]);
    return () => clearTimeout(timer);
  }, [paused, toast, onDismiss]);

  return (
    <div
      className={`toast toast--${toast.type}`}
      role={toast.type === 'error' ? 'alert' : 'status'}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <span className="toast__icon" aria-hidden="true">
        {ICONS[toast.type]}
      </span>
      <p className="toast__message">{toast.message}</p>
      <button type="button" className="toast__close" onClick={() => onDismiss(toast.id)} aria-label="Dismiss message">
        ×
      </button>
    </div>
  );
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const nextId = useRef(1);

  const dismissToast = useCallback((id) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const showToast = useCallback(({ type = 'info', message }) => {
    const id = nextId.current++;
    setToasts((current) => [...current, { id, type, message }].slice(-MAX_TOASTS));
  }, []);

  const value = useMemo(() => ({ showToast }), [showToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {/* The region exists before any toast does, which screen readers need in
          order to announce what is added to it. Errors use role="alert",
          which is announced at once, interrupting other speech. */}
      <div className="toast-region" aria-live="polite">
        {toasts.map((toast) => (
          <Toast key={toast.id} toast={toast} onDismiss={dismissToast} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used inside <ToastProvider>');
  return context;
}
