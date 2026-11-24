// Stand-ins when there is no image: a gradient and initials derived from a
// stable seed (an id or a name), so the same thing always looks the same.

// FNV-1a over the characters, then MurmurHash3's final mix, so seeds that
// differ in one character (event-1, event-2) land far apart on the colour
// wheel instead of on neighbouring or alternating hues.
export function hueFrom(seed) {
  let hash = 2166136261;
  for (const char of String(seed)) {
    hash = Math.imul(hash ^ char.codePointAt(0), 16777619);
  }
  hash = Math.imul(hash ^ (hash >>> 16), 0x85ebca6b);
  hash = Math.imul(hash ^ (hash >>> 13), 0xc2b2ae35);
  return ((hash ^ (hash >>> 16)) >>> 0) % 360;
}

// Dark enough at every hue for white initials to meet 4.5:1 (see the tests).
export const AVATAR_LIGHTNESS = 28;

export function avatarBackground(seed) {
  const hue = hueFrom(seed);
  return `linear-gradient(135deg, hsl(${hue} 60% ${AVATAR_LIGHTNESS}%), hsl(${(hue + 40) % 360} 60% ${AVATAR_LIGHTNESS}%))`;
}

// Covers carry no text, so they can be brighter. Neighbouring hues (an
// analogous palette) keep every cover harmonious rather than muddy.
export function coverBackground(seed) {
  const hue = hueFrom(seed);
  return [
    `radial-gradient(circle at 18% 22%, hsl(${(hue + 50) % 360} 90% 72% / 0.85), transparent 55%)`,
    `radial-gradient(circle at 85% 85%, hsl(${(hue + 320) % 360} 80% 55% / 0.6), transparent 50%)`,
    `linear-gradient(135deg, hsl(${hue} 72% 52%), hsl(${(hue + 30) % 360} 70% 40%))`,
  ].join(', ');
}

// "Ali Hassan" -> "AH", "Photography Club" -> "PC", "Madonna" -> "M".
export function initials(name) {
  const words = String(name).trim().split(/\s+/).filter(Boolean);
  const letters = words.length > 1 ? [words[0], words.at(-1)] : words;
  return letters.map((word) => [...word][0].toUpperCase()).join('');
}
