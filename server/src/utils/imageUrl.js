const PATHS = { avatar: 'avatars', cover: 'covers' };

// The URL carries the image's version (its last update in milliseconds), so a
// replaced image gets a new URL and no browser shows the old one from cache.
// Returns null when there is no image.
export function imageUrl(kind, ownerId, updatedAt) {
  return updatedAt ? `/api/images/${PATHS[kind]}/${ownerId}?v=${updatedAt.getTime()}` : null;
}
