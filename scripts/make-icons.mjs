// Draws public/icon/{16,32,48,128}.png and docs/logo.png: an hourglass on an ember tile.
import { mkdirSync, writeFileSync } from 'node:fs';
import { encodePng } from './png.mjs';

const TOP = [255, 138, 76];
const BOTTOM = [232, 74, 31];
const SS = 4;

function colorAt(u, v) {
  const r = 0.22;
  const cx = Math.min(Math.max(u, r), 1 - r);
  const cy = Math.min(Math.max(v, r), 1 - r);
  if ((u - cx) ** 2 + (v - cy) ** 2 > r * r) return null;
  const bg = TOP.map((c, i) => c + (BOTTOM[i] - c) * v);
  const blend = (a) => bg.map((c) => c + (255 - c) * a);
  // Caps
  if (u >= 0.27 && u <= 0.73 && ((v >= 0.2 && v <= 0.255) || (v >= 0.745 && v <= 0.8))) return blend(1);
  // Glass: width shrinks toward the waist at v = 0.5
  const half = 0.2 * (Math.abs(v - 0.5) / 0.245) + 0.025;
  if (v > 0.255 && v < 0.745 && Math.abs(u - 0.5) <= half) {
    // Sand: a pile in the bottom bulb and a little left on top.
    const inBottomPile = v > 0.6;
    const inTopSand = v > 0.255 && v < 0.33;
    return blend(inBottomPile || inTopSand ? 1 : 0.35);
  }
  return bg;
}

function draw(size) {
  return encodePng(size, size, (x, y) => {
    const acc = [0, 0, 0, 0];
    for (let i = 0; i < SS; i++) {
      for (let j = 0; j < SS; j++) {
        const c = colorAt((x + (i + 0.5) / SS) / size, (y + (j + 0.5) / SS) / size);
        if (!c) continue;
        acc[0] += c[0]; acc[1] += c[1]; acc[2] += c[2]; acc[3]++;
      }
    }
    const n = acc[3];
    return n ? [acc[0] / n, acc[1] / n, acc[2] / n, (255 * n) / (SS * SS)].map(Math.round) : [0, 0, 0, 0];
  });
}

mkdirSync(new URL('../docs', import.meta.url), { recursive: true });
for (const size of [16, 32, 48, 128]) writeFileSync(new URL(`../public/icon/${size}.png`, import.meta.url), draw(size));
writeFileSync(new URL('../docs/logo.png', import.meta.url), draw(256));
console.log('wrote icons');
