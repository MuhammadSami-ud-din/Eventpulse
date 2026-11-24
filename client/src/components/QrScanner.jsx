import { useEffect, useRef, useState } from 'react';

const SCAN_INTERVAL_MS = 250;
// Decoding a downscaled frame is much faster and still reads a QR held up to the camera.
const MAX_FRAME_WIDTH = 640;

function cameraErrorMessage(error) {
  if (!window.isSecureContext) return 'The camera only works over HTTPS (or on localhost). Type the code instead.';
  switch (error?.name) {
    case 'NotAllowedError':
      return 'Camera permission was denied. Allow it in your browser settings, or type the code instead.';
    case 'NotFoundError':
    case 'OverconstrainedError':
      return 'No camera was found on this device. Type the code instead.';
    case 'NotReadableError':
      return 'The camera is being used by another app.';
    default:
      return 'Could not start the camera. Type the code instead.';
  }
}

// Shows the back camera and calls onScan(text) whenever a QR code is in view.
// The same code is reported again on every frame, so the caller de-duplicates.
// jsQR is loaded only when the scanner opens, keeping it out of the main bundle.
export function QrScanner({ onScan }) {
  const videoRef = useRef(null);
  const onScanRef = useRef(onScan);
  const [status, setStatus] = useState('starting');
  const [error, setError] = useState('');

  useEffect(() => {
    onScanRef.current = onScan;
  });

  useEffect(() => {
    let cancelled = false;
    let stream;
    let timer;
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d', { willReadFrequently: true });
    const stopCamera = () => stream?.getTracks().forEach((track) => track.stop());

    function scanFrame(jsQR, video) {
      if (video.readyState < video.HAVE_ENOUGH_DATA) return;
      const scale = Math.min(1, MAX_FRAME_WIDTH / video.videoWidth);
      canvas.width = Math.round(video.videoWidth * scale);
      canvas.height = Math.round(video.videoHeight * scale);
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      const { data, width, height } = context.getImageData(0, 0, canvas.width, canvas.height);
      const result = jsQR(data, width, height, { inversionAttempts: 'dontInvert' });
      if (result?.data) onScanRef.current(result.data);
    }

    async function start() {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error('Camera API unavailable');
        const [{ default: jsQR }, mediaStream] = await Promise.all([
          import('jsqr'),
          navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false }),
        ]);
        stream = mediaStream;
        // The component may have closed while the permission prompt was open.
        if (cancelled) return stopCamera();
        const video = videoRef.current;
        video.srcObject = stream;
        await video.play();
        setStatus('scanning');
        timer = setInterval(() => scanFrame(jsQR, video), SCAN_INTERVAL_MS);
      } catch (cameraError) {
        stopCamera();
        if (!cancelled) {
          setError(cameraErrorMessage(cameraError));
          setStatus('error');
        }
      }
      return undefined;
    }

    start();
    return () => {
      cancelled = true;
      clearInterval(timer);
      stopCamera();
    };
  }, []);

  return (
    <div className="scanner">
      <div className={`scanner__viewport ${status === 'error' ? 'scanner__viewport--hidden' : ''}`}>
        <video ref={videoRef} className="scanner__video" muted playsInline aria-label="Camera preview" />
        <div className="scanner__frame" aria-hidden="true" />
      </div>
      {status === 'starting' && <p role="status">Starting camera…</p>}
      {status === 'scanning' && <p className="scanner__hint">Point the camera at the ticket’s QR code.</p>}
      {status === 'error' && (
        <p role="alert" className="field__error">
          {error}
        </p>
      )}
    </div>
  );
}
