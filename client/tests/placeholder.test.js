import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { AVATAR_LIGHTNESS, avatarBackground, coverBackground, hueFrom, initials } from '../src/utils/placeholder.js';

// WCAG relative luminance of an HSL colour (saturation as used by avatars).
function luminance(hue, saturation, lightness) {
  const s = saturation / 100;
  const l = lightness / 100;
  const a = s * Math.min(l, 1 - l);
  const channel = (n) => {
    const k = (n + hue / 30) % 12;
    const value = l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(0) + 0.7152 * channel(8) + 0.0722 * channel(4);
}

describe('placeholders', () => {
  test('the same seed always gives the same colours', () => {
    assert.equal(hueFrom('Ali Hassan'), hueFrom('Ali Hassan'));
    assert.equal(avatarBackground(42), avatarBackground(42));
    assert.equal(coverBackground('event-7'), coverBackground('event-7'));
    assert.notEqual(coverBackground('event-7'), coverBackground('event-8'));
    assert.ok(hueFrom('x') >= 0 && hueFrom('x') < 360);
  });

  test('white initials meet 4.5:1 contrast on an avatar of any hue', () => {
    for (let hue = 0; hue < 360; hue += 1) {
      const ratio = 1.05 / (luminance(hue, 60, AVATAR_LIGHTNESS) + 0.05);
      assert.ok(ratio >= 4.5, `hue ${hue}: ${ratio.toFixed(2)}`);
    }
  });

  test('initials: first and last word, any script, any spacing', () => {
    assert.equal(initials('Ali Hassan'), 'AH');
    assert.equal(initials('  Arts & Literary   Society '), 'AS');
    assert.equal(initials('Madonna'), 'M');
    assert.equal(initials('علی حسن'), 'عح');
    assert.equal(initials('élodie durand'), 'ÉD');
  });
});
