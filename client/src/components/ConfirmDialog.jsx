import { useEffect, useRef } from 'react';

// Built on the native <dialog>: showModal() traps focus, Escape closes it,
// and focus returns to the button that opened it. `children` (e.g. a reason
// field) render between the message and the buttons.
//
// Only the `open` prop opens or closes it. Escape fires a "cancel" event,
// which is turned into onCancel. Listening to "close" instead would be wrong:
// it also fires, a moment later, after our own close(), and when the dialog
// is reopened quickly that late event would shut the new one.
export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  cancelLabel = 'Keep it',
  onConfirm,
  onCancel,
  busy,
  children,
}) {
  const dialogRef = useRef(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      className="dialog"
      aria-labelledby="dialog-title"
      onCancel={(e) => {
        e.preventDefault();
        if (!busy) onCancel();
      }}
    >
      <h2 id="dialog-title" className="dialog__title">
        {title}
      </h2>
      <p>{message}</p>
      {children}
      <div className="dialog__actions">
        <button type="button" className="button" onClick={onCancel} disabled={busy}>
          {cancelLabel}
        </button>
        <button type="button" className="button button--danger" onClick={onConfirm} disabled={busy}>
          {busy ? 'Working…' : confirmLabel}
        </button>
      </div>
    </dialog>
  );
}
