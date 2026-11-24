import { HttpError } from '../utils/HttpError.js';

export function notFound(req, res, next) {
  next(new HttpError(404, 'NOT_FOUND', `Route ${req.method} ${req.originalUrl} not found`));
}

// Express recognises error handlers by their four parameters, so `next` must stay.
export function errorHandler(err, req, res, next) {
  if (err instanceof HttpError) {
    const body = { code: err.code, message: err.message };
    if (err.details) body.details = err.details;
    return res.status(err.status).json({ error: body });
  }

  // Errors from express.json() while reading the body.
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: { code: 'INVALID_JSON', message: 'Request body is not valid JSON' } });
  }
  if (err.type === 'entity.too.large') {
    return res.status(413).json({ error: { code: 'PAYLOAD_TOO_LARGE', message: 'Request body is too large' } });
  }
  // Any other body problem it reports as the client's fault (e.g. an unknown
  // charset or a request aborted mid-way). `expose` marks those as safe to show.
  if (err.expose && err.status >= 400 && err.status < 500) {
    return res.status(err.status).json({ error: { code: 'BAD_REQUEST', message: err.message } });
  }

  console.error(err);
  return res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Something went wrong' } });
}
