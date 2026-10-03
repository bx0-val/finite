import { browser } from 'wxt/browser';
import { applyDelta, dayKey, emptyDay, type DayStats, type Delta } from './stats';

// storage.local layout:
//   day:YYYY-MM-DD  → DayStats
//   seen:YYYY-MM-DD → string[] of post ids counted that day (kept 2 days)

const DAY = 'day:';
const SEEN = 'seen:';

export async function loadDays(): Promise<Record<string, DayStats>> {
  const all = await browser.storage.local.get(null);
  const days: Record<string, DayStats> = {};
  for (const [key, value] of Object.entries(all)) {
    if (key.startsWith(DAY)) {
      const base = emptyDay();
      const day = value as Partial<DayStats>;
      days[key.slice(DAY.length)] = { ...base, ...day, hourly: { ...base.hourly, ...day.hourly } };
    }
  }
  return days;
}

let queue: Promise<unknown> = Promise.resolve();

/** Serialised so deltas from several tabs never overwrite each other. */
export function recordDelta(delta: Delta): Promise<void> {
  const run = queue.then(() => write(delta));
  queue = run.catch(() => {});
  return run;
}

async function write(delta: Delta) {
  const dayId = DAY + delta.day;
  const seenId = SEEN + delta.day;
  const stored = await browser.storage.local.get([dayId, seenId]);
  const seen = new Set<string>((stored[seenId] as string[] | undefined) ?? []);
  const day = applyDelta({ ...emptyDay(), ...(stored[dayId] as DayStats | undefined) }, seen, delta);
  await browser.storage.local.set({ [dayId]: day, [seenId]: [...seen] });
}

/** Drops de-duplication lists older than yesterday; the day totals stay. */
export async function pruneSeen(today = new Date()) {
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const keep = new Set([SEEN + dayKey(today), SEEN + dayKey(yesterday)]);
  const keys = Object.keys(await browser.storage.local.get(null)).filter((k) => k.startsWith(SEEN) && !keep.has(k));
  if (keys.length) await browser.storage.local.remove(keys);
}

export async function clearAll() {
  await browser.storage.local.clear();
}
