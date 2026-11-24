import { PNG } from 'pngjs';

// Generated cover images for the demo events: a diagonal gradient in the
// category's colour, two soft glows and a few faint rings. Pure maths, so the
// seed needs no image files. (pngjs is a dev dependency; the seed is a
// development tool and refuses to run in production.)

const WIDTH = 480;
const HEIGHT = 270;
const CATEGORY_HUES = {
  technology: 222,
  workshops: 262,
  sports: 150,
  'arts-culture': 330,
  career: 28,
  entrepreneurship: 8,
  'community-service': 172,
  'academic-talks': 198,
};

function hslToRgb(hue, saturation, lightness) {
  const s = saturation / 100;
  const l = lightness / 100;
  const a = s * Math.min(l, 1 - l);
  const channel = (n) => {
    const k = (n + hue / 30) % 12;
    return 255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)));
  };
  return [channel(0), channel(8), channel(4)];
}

const mix = (base, top, alpha) => base.map((value, i) => value + (top[i] - value) * alpha);
// 0 outside the radius, rising smoothly to 1 at the centre.
const falloff = (distance, radius) => Math.max(0, 1 - distance / radius) ** 2;

export function generateCover(category, variant) {
  const hue = ((CATEGORY_HUES[category] ?? 220) + (variant * 23) % 40 + 360) % 360;
  const from = hslToRgb(hue, 72, 54);
  const to = hslToRgb((hue + 30) % 360, 70, 36);
  const glowA = hslToRgb((hue + 50) % 360, 90, 74);
  const glowB = hslToRgb((hue + 320) % 360, 80, 58);
  const white = [255, 255, 255];
  const rings = [0.22, 0.34, 0.46].map((size, i) => ({
    x: WIDTH * (0.72 + 0.05 * ((variant + i) % 3)),
    y: HEIGHT * 0.38,
    r: WIDTH * size,
  }));

  const png = new PNG({ width: WIDTH, height: HEIGHT, colorType: 2, inputHasAlpha: false });
  for (let y = 0; y < HEIGHT; y += 1) {
    for (let x = 0; x < WIDTH; x += 1) {
      let color = mix(from, to, (x / WIDTH) * 0.6 + (y / HEIGHT) * 0.4);
      color = mix(color, glowA, 0.85 * falloff(Math.hypot(x - WIDTH * 0.18, y - HEIGHT * 0.2), WIDTH * 0.55));
      color = mix(color, glowB, 0.55 * falloff(Math.hypot(x - WIDTH * 0.88, y - HEIGHT * 0.9), WIDTH * 0.45));
      for (const ring of rings) {
        // A 2px line, faded in and out over a pixel so its edge is smooth.
        const edge = Math.abs(Math.hypot(x - ring.x, y - ring.y) - ring.r);
        if (edge < 2) color = mix(color, white, 0.16 * (1 - edge / 2));
      }
      const offset = (y * WIDTH + x) * 3;
      png.data[offset] = Math.round(color[0]);
      png.data[offset + 1] = Math.round(color[1]);
      png.data[offset + 2] = Math.round(color[2]);
    }
  }
  return PNG.sync.write(png, { colorType: 2, inputColorType: 2, inputHasAlpha: false, deflateLevel: 9 });
}
