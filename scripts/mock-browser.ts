// Stand-in for wxt/browser used by scripts/screenshot.mjs: in-memory storage
// seeded with deterministic, realistic-looking demo data.
import { applyDelta, dayKey, emptyDay, type DayStats, type SeenPost } from '../lib/stats';

let seed = 7;
const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

// How likely someone is to be scrolling at each hour.
const HOUR_WEIGHT = [2, 1, 0.5, 0.2, 0.1, 0.2, 1, 3, 5, 4, 2.5, 2, 3.5, 3, 2, 2, 2.2, 2.6, 3, 3.5, 4.5, 6, 6.5, 4];

function demoDay(date: Date, scale: number): DayStats {
  const key = dayKey(date);
  let day = emptyDay();
  const seen = new Set<string>();
  const weekend = date.getDay() === 0 || date.getDay() === 6;
  const total = Math.round((380 + rand() * 900) * (weekend ? 1.35 : 1) * scale);
  const weightSum = HOUR_WEIGHT.reduce((a, b) => a + b, 0);
  let id = 0;
  HOUR_WEIGHT.forEach((w, hour) => {
    const n = Math.round((total * w * (0.6 + rand() * 0.8)) / weightSum);
    const posts: SeenPost[] = Array.from({ length: n }, () => ({
      id: `${key}-${id++}`,
      author: `user${Math.floor(rand() * 900)}`,
      ad: rand() < 0.085,
      media: rand() < 0.38,
      words: Math.round(4 + rand() * 32),
    }));
    day = applyDelta(day, seen, {
      day: key, hour, posts,
      distancePx: Math.round(n * (430 + rand() * 180)),
      activeMs: Math.round(n * (3200 + rand() * 2200)),
      likes: Math.round((n / 110) * rand() * 2),
      reposts: rand() < n / 250 ? 1 : 0,
    });
  });
  return day;
}

const store: Record<string, unknown> = {};
const now = new Date();
for (let i = 44; i >= 0; i--) {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
  // Today is still in progress, so scale it down to the hours so far.
  store[`day:${dayKey(d)}`] = demoDay(d, i === 0 ? 0.7 : 1);
}

export const browser = {
  storage: {
    local: {
      get: async (keys: string | string[] | null) => {
        if (keys === null) return { ...store };
        return Object.fromEntries([keys].flat().filter((k) => k in store).map((k) => [k, store[k]]));
      },
      set: async (items: Record<string, unknown>) => void Object.assign(store, items),
      remove: async (keys: string[]) => keys.forEach((k) => delete store[k]),
      clear: async () => Object.keys(store).forEach((k) => delete store[k]),
    },
    onChanged: { addListener: () => {} },
  },
};
