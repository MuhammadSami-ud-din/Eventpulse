import { HttpError } from '../utils/HttpError.js';

// The API only reads JSON. express.json() skips bodies of other types, which
// would then look like an empty object and fail validation with a misleading
// "field is required". Requests without a body (most GETs) pass through.
export function requireJsonBody(req, res, next) {
  const hasBody = Number(req.get('content-length')) > 0 || req.get('transfer-encoding') !== undefined;
  if (hasBody && !req.is('application/json')) {
    return next(new HttpError(415, 'UNSUPPORTED_MEDIA_TYPE', 'Send the request body as JSON'));
  }
  next();
}
