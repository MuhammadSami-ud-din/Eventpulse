import { useEffect, useRef } from 'react';

// A native modal <dialog>: showModal() keeps focus inside it and makes the
// rest of the page inert; closing returns focus to where it was. As in
// ConfirmDialog, only `open` opens or closes it, and Escape becomes onClose.
export function Modal({ open, onClose, label, className = '', children }) {
  const dialogRef = useRef(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      className={`modal ${className}`}
      aria-label={label}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      // A click on the backdrop lands on the <dialog> element itself.
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {/* The body fills the dialog, so only a click outside it hits the <dialog>. */}
      {open && <div className="modal__body">{children}</div>}
    </dialog>
  );
}
