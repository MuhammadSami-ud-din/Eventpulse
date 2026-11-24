import { getAccountSummary } from '../services/accountSummary.service.js';
import { invalidateAllEvents } from '../services/cache.js';
import { removeImage, saveImage } from '../services/image.service.js';

// Events show their organizer's avatar, so cached events must be refreshed
// when an organizer or admin changes theirs.
function refreshEventsShowing(user) {
  if (user.role !== 'student') invalidateAllEvents();
}

export async function uploadAvatar(req, res) {
  const avatarUrl = await saveImage('avatar', req.user.id, req.body);
  refreshEventsShowing(req.user);
  res.json({ avatarUrl });
}

export async function removeAvatar(req, res) {
  await removeImage('avatar', req.user.id);
  refreshEventsShowing(req.user);
  res.status(204).end();
}

export async function getSummary(req, res) {
  res.json({ summary: await getAccountSummary(req.user) });
}
