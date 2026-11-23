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

  // Malformed JSON body from express.json().
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: { code: 'INVALID_JSON', message: 'Request body is not valid JSON' } });
  }

  console.error(err);
  return res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Something went wrong' } });
}
