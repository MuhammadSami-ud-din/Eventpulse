import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { centerSquare, checkSourceFile, fitWithin } from '../src/utils/imageResize.js';
import { formatCountdown } from '../src/utils/format.js';

describe('image preparation', () => {
  test('fits inside the limit keeping the shape, and never enlarges', () => {
    assert.deepEqual(fitWithin(4000, 3000, 1280), { width: 1280, height: 960 });
    assert.deepEqual(fitWithin(3000, 4000, 512), { width: 384, height: 512 });
    assert.deepEqual(fitWithin(300, 200, 512), { width: 300, height: 200 });
  });

  test('avatars use the centred square of the picture', () => {
    assert.deepEqual(centerSquare(4000, 3000), { x: 500, y: 0, size: 3000 });
    assert.deepEqual(centerSquare(1000, 1600), { x: 0, y: 300, size: 1000 });
  });

  test('only JPEG, PNG and WebP up to 20 MB are accepted for processing', () => {
    assert.equal(checkSourceFile({ type: 'image/png', size: 1000 }), null);
    assert.match(checkSourceFile({ type: 'image/svg+xml', size: 100 }), /JPEG, PNG or WebP/);
    assert.match(checkSourceFile({ type: 'image/gif', size: 100 }), /JPEG, PNG or WebP/);
    assert.match(checkSourceFile({ type: 'image/jpeg', size: 21 * 1024 * 1024 }), /over 20 MB/);
  });
});

describe('countdown', () => {
  const MINUTE = 60 * 1000;
  test('shows the two largest units, and nothing once passed', () => {
    assert.equal(formatCountdown((2 * 24 * 60 + 4 * 60 + 30) * MINUTE), '2 days 4 hours');
    assert.equal(formatCountdown((3 * 60 + 15) * MINUTE), '3 hours 15 minutes');
    assert.equal(formatCountdown(61 * MINUTE), '1 hour 1 minute');
    assert.equal(formatCountdown(12 * MINUTE + 5000), '12 minutes');
    assert.equal(formatCountdown(20 * 1000), 'less than a minute');
    assert.equal(formatCountdown(0), null);
    assert.equal(formatCountdown(-5), null);
  });
});
