import { LRUCache } from 'lru-cache';

// In-process cache: fast and dependency-free, but each server process has its
// own copy. Running several instances would need a shared cache (e.g. Redis).
// The TTL is a safety net; correctness comes from invalidating on every write.
const cache = new LRUCache({ max: 500, ttl: 30 * 1000 });

const EVENT_LIST_PREFIX = 'events:list:';

export const cacheKeys = {
  // The validated query has a fixed key order, so equal filters give equal keys.
  eventList: (query) => `${EVENT_LIST_PREFIX}${JSON.stringify(query)}`,
  eventDetail: (id) => `events:detail:${id}`,
  categories: 'categories',
};

export async function remember(key, load) {
  if (cache.has(key)) return cache.get(key);
  const value = await load();
  cache.set(key, value);
  return value;
}

// Any change to one event can change any list page (seat counts, ordering,
// filters), so all cached lists are dropped along with the event's detail.
export function invalidateEvent(eventId) {
  cache.delete(cacheKeys.eventDetail(eventId));
  for (const key of [...cache.keys()]) {
    if (key.startsWith(EVENT_LIST_PREFIX)) cache.delete(key);
  }
}

export function invalidateCategories() {
  cache.delete(cacheKeys.categories);
}
