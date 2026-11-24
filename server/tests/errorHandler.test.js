import assert from 'node:assert/strict';
import { describe, mock, test } from 'node:test';
import { errorHandler } from '../src/middleware/errorHandler.js';
import { HttpError } from '../src/utils/HttpError.js';

// Just enough of Express's response object to see what the handler sends.
function fakeResponse() {
  const res = { statusCode: null, body: null };
  res.status = (code) => {
    res.statusCode = code;
    return res;
  };
  res.json = (body) => {
    res.body = body;
    return res;
  };
  return res;
}

function handle(err) {
  const res = fakeResponse();
  errorHandler(err, {}, res, () => {});
  return res;
}

describe('error handler', () => {
  test('an unexpected error is logged, but the client only gets a generic 500', (t) => {
    const log = t.mock.method(console, 'error', () => {});
    const secret = new Error('connect ECONNREFUSED db.internal:3306 user=eventhub password=hunter2');

    const res = handle(secret);

    assert.equal(res.statusCode, 500);
    assert.deepEqual(res.body, { error: { code: 'INTERNAL_ERROR', message: 'Something went wrong' } });
    assert.equal(log.mock.callCount(), 1, 'the details go to the server log');
    assert.equal(log.mock.calls[0].arguments[0], secret);
  });

  test('an HttpError is sent as is, with field details when it has them', () => {
    const details = [{ field: 'email', message: 'Enter a valid email address' }];
    const res = handle(new HttpError(400, 'VALIDATION_ERROR', 'Some fields are invalid', details));
    assert.equal(res.statusCode, 400);
    assert.deepEqual(res.body.error, { code: 'VALIDATION_ERROR', message: 'Some fields are invalid', details });
  });

  test('other body errors the JSON parser marks as safe keep their 4xx status', () => {
    const unsupportedCharset = Object.assign(new Error('unsupported charset "UTF-7"'), {
      status: 415,
      expose: true,
      type: 'charset.unsupported',
    });
    const res = handle(unsupportedCharset);
    assert.equal(res.statusCode, 415);
    assert.equal(res.body.error.code, 'BAD_REQUEST');
  });

  test('a 5xx error is never exposed, even if marked as safe', () => {
    mock.method(console, 'error', () => {});
    const res = handle(Object.assign(new Error('stream failure'), { status: 500, expose: true }));
    assert.equal(res.statusCode, 500);
    assert.equal(res.body.error.message, 'Something went wrong');
    mock.restoreAll();
  });
});
