import { HttpError } from '../utils/HttpError.js';

function toDetails(error) {
  return error.issues.map((issue) => ({ field: issue.path.join('.'), message: issue.message }));
}

// Usage: validate({ body: schema, query: schema, params: schema }).
// Parsed (trimmed, coerced, unknown-keys-stripped) values land on req.validated;
// Express 5 makes req.query read-only, so the raw request is left untouched.
export function validate(schemas) {
  return (req, res, next) => {
    req.validated = {};
    for (const [source, schema] of Object.entries(schemas)) {
      const result = schema.safeParse(req[source] ?? {});
      if (!result.success) {
        return next(new HttpError(400, 'VALIDATION_ERROR', 'Some fields are invalid', toDetails(result.error)));
      }
      req.validated[source] = result.data;
    }
    next();
  };
}
