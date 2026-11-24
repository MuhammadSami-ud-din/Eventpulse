import { useEffect, useId, useRef, useState } from 'react';
import { errorMessage } from '../utils/errors.js';
import { prepareImage } from '../utils/imageResize.js';
import { ConfirmDialog } from './ConfirmDialog.jsx';
import { Icon } from './Icon.jsx';

// Choose, replace or remove an image (avatar or cover). The picture is
// resized and compressed in the browser first, then uploaded; the preview
// shows the new image immediately.
//   `preview(url)` renders the current image (or a placeholder when url is null).
//   `onUpload(blob)` resolves to the new image URL; `onRemove()` removes it.
export function ImageUploader({ label, imageUrl, maxSize, square = false, preview, onUpload, onRemove, hint }) {
  const inputRef = useRef(null);
  const statusId = useId();
  const [status, setStatus] = useState({ busy: false, error: '', message: '' });
  const [localUrl, setLocalUrl] = useState(null);
  const [confirmRemove, setConfirmRemove] = useState(false);

  const shownUrl = localUrl ?? imageUrl;

  // Previews are temporary blob: URLs; release each one when it is replaced
  // or the uploader goes away, so the image is not kept in memory.
  useEffect(() => () => localUrl && URL.revokeObjectURL(localUrl), [localUrl]);

  async function handleFile(e) {
    const file = e.target.files[0];
    e.target.value = ''; // choosing the same file again still triggers a change
    if (!file) return;
    setStatus({ busy: true, error: '', message: 'Preparing and uploading…' });
    try {
      const blob = await prepareImage(file, { maxSize, square });
      await onUpload(blob);
      setLocalUrl(URL.createObjectURL(blob));
      setStatus({ busy: false, error: '', message: `${label} updated.` });
    } catch (error) {
      setStatus({ busy: false, error: error.response ? errorMessage(error) : error.message, message: '' });
    }
  }

  async function handleRemove() {
    setStatus({ busy: true, error: '', message: 'Removing…' });
    try {
      await onRemove();
      setLocalUrl(null);
      setConfirmRemove(false);
      setStatus({ busy: false, error: '', message: `${label} removed.` });
    } catch (error) {
      setConfirmRemove(false);
      setStatus({ busy: false, error: errorMessage(error), message: '' });
    }
  }

  return (
    <div className="uploader">
      <div className="uploader__preview">{preview(shownUrl)}</div>
      <div className="uploader__controls">
        {/* The real file input is hidden; this button opens it, so keyboard
            users get an ordinary button with a clear name. */}
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="visually-hidden"
          tabIndex={-1}
          aria-hidden="true"
          onChange={handleFile}
        />
        <div className="uploader__buttons">
          <button
            type="button"
            className="button"
            onClick={() => inputRef.current.click()}
            disabled={status.busy}
            aria-describedby={statusId}
          >
            <Icon name="plus" size={16} />
            {shownUrl ? `Replace ${label.toLowerCase()}` : `Upload ${label.toLowerCase()}`}
          </button>
          {shownUrl && (
            <button type="button" className="button button--ghost" onClick={() => setConfirmRemove(true)} disabled={status.busy}>
              Remove
            </button>
          )}
        </div>
        {hint && <p className="field__hint">{hint}</p>}
        <p id={statusId} className={status.error ? 'field__error' : 'field__hint'} role={status.error ? 'alert' : 'status'}>
          {status.error || status.message}
        </p>
      </div>
      <ConfirmDialog
        open={confirmRemove}
        title={`Remove this ${label.toLowerCase()}?`}
        message="A generated placeholder will be shown instead."
        confirmLabel="Remove"
        cancelLabel="Cancel"
        onConfirm={handleRemove}
        onCancel={() => setConfirmRemove(false)}
        busy={status.busy}
      />
    </div>
  );
}
