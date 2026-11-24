import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { errorCode, errorMessage, fieldErrors } from '../src/utils/errors.js';

// Shaped like the errors axios throws.
const apiError = (error) => ({ response: { data: { error } } });

describe('API error helpers', () => {
  test("the server's message is shown when there is one", () => {
    const error = apiError({ code: 'EVENT_FULL', message: 'This event is full' });
    assert.equal(errorMessage(error), 'This event is full');
    assert.equal(errorCode(error), 'EVENT_FULL');
  });

  test('no response at all means the network, which gets its own message', () => {
    assert.match(errorMessage({ request: {} }), /Cannot reach the server/);
    assert.equal(errorCode({ request: {} }), null);
  });

  test('anything else falls back to a generic or caller-given message', () => {
    assert.equal(errorMessage(new Error('bug')), 'Something went wrong, please try again');
    assert.equal(errorMessage({ response: { data: '<html>' } }, 'Could not save'), 'Could not save');
  });

  test('field details become { field: message }, keeping the first message per field', () => {
    const error = apiError({
      code: 'VALIDATION_ERROR',
      details: [
        { field: 'email', message: 'Enter a valid email address' },
        { field: 'email', message: 'Must be at most 255 characters' },
        { field: 'fullName', message: 'Name is too short' },
      ],
    });
    assert.deepEqual(fieldErrors(error), { email: 'Enter a valid email address', fullName: 'Name is too short' });
    assert.deepEqual(fieldErrors(new Error('no details')), {});
  });
});
