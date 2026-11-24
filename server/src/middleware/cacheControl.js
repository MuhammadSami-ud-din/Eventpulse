// Default for the whole API: responses may contain personal data, so browsers
// and proxies must not store them.
export function noStore(req, res, next) {
  res.set('Cache-Control', 'no-store');
  next();
}

// For public data that can change at any moment (seat counts, a category an
// admin just renamed). Caches may keep a copy but must revalidate every time;
// Express adds an ETag to each response, so an unchanged resource costs a 304
// with no body.
export function publicRevalidate(req, res, next) {
  res.set('Cache-Control', 'public, no-cache');
  next();
}
