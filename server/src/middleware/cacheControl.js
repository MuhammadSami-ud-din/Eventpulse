// Default for the whole API: responses may contain personal data, so browsers
// and proxies must not store them.
export function noStore(req, res, next) {
  res.set('Cache-Control', 'no-store');
  next();
}

// For public data that changes often (seat counts). Caches may keep a copy but
// must revalidate every time; Express adds an ETag to each response, so an
// unchanged resource costs a 304 with no body.
export function publicRevalidate(req, res, next) {
  res.set('Cache-Control', 'public, no-cache');
  next();
}

// For public data that rarely changes (categories).
export function publicMaxAge(seconds) {
  return (req, res, next) => {
    res.set('Cache-Control', `public, max-age=${seconds}`);
    next();
  };
}
