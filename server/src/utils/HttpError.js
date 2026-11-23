// An error that is safe to show to the client. Anything else that reaches the
// error handler is treated as an unexpected 500 and its details stay in the logs.
export class HttpError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}
