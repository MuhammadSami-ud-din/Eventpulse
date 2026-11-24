import { useToast } from '../context/ToastContext.jsx';
import { Icon } from './Icon.jsx';

async function copyLink(url, showToast) {
  try {
    await navigator.clipboard.writeText(url);
    showToast({ type: 'success', message: 'Link copied.' });
  } catch {
    showToast({ type: 'error', message: `Copy this link: ${url}` });
  }
}

// Uses the device's share sheet where there is one (most phones). If there is
// none, or the browser refuses to open it, the link is copied instead.
export function ShareButton({ title, url }) {
  const { showToast } = useToast();

  async function handleShare() {
    if (navigator.share) {
      try {
        await navigator.share({ title, url });
        return;
      } catch (error) {
        // Closing the share sheet is the user's choice, not a failure.
        if (error.name === 'AbortError') return;
      }
    }
    await copyLink(url, showToast);
  }

  return (
    <button type="button" className="button" onClick={handleShare}>
      <Icon name="share" size={16} />
      Share
    </button>
  );
}
