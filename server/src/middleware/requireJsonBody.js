import { HttpError } from '../utils/HttpError.js';
import { IMAGE_TYPES } from '../utils/imageType.js';

// The API reads JSON, plus raw images on the upload routes. express.json()
// skips bodies of other types, which would then look like an empty object and
// fail validation with a misleading "field is required". Image bodies are only
// read by routes that use imageBody(); elsewhere they fail validation as usual.
// Requests without a body (most GETs) pass through.
export function requireJsonBody(req, res, next) {
  const hasBody = Number(req.get('content-length')) > 0 || req.get('transfer-encoding') !== undefined;
  if (hasBody && !req.is('application/json') && !req.is(IMAGE_TYPES)) {
    return next(new HttpError(415, 'UNSUPPORTED_MEDIA_TYPE', 'Send the request body as JSON, or an image as JPEG, PNG or WebP'));
  }
  next();
}
