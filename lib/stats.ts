// Per-day metrics, how tracker deltas merge into them, and how the dashboard
// slices them into ranges and chunks. Pure functions, no browser APIs.

export interface DayStats {
  /** Posts at least half on screen, de-duplicated per day. */
  posts: number;
  ads: number;
  /** Posts with photos, video or GIFs. */
  media: number;
  /** Words in the text of counted posts. */
  words: number;
  /** Total scroll movement in CSS pixels (both directions). */
  distancePx: number;
  /** Time X was visible, focused and recently interacted with. */
  activeMs: number;
  likes: number;
  reposts: number;
  /** Each metric split by local hour 0–23. */
  hourly: Record<Metric, number[]>;
  /** Lower-cased handles of accounts whose posts were counted (capped). */
  authors: string[];
}

export interface SeenPost {
  id: string;
  author: string | null;
  ad: boolean;
  media: boolean;
  words: number;
}

export interface Delta {
  /** Local date, YYYY-MM-DD. */
  day: string;
  /** Local hour 0–23. */
  hour: number;
  posts: SeenPost[];
  distancePx: number;
  activeMs: number;
  likes: number;
  reposts: number;
}

export const MAX_AUTHORS_PER_DAY = 2000;
export const METRICS = ['posts', 'distancePx', 'activeMs', 'words', 'ads', 'media', 'likes', 'reposts'] as const;
export type Metric = (typeof METRICS)[number];

const emptyHourly = () => Object.fromEntries(METRICS.map((m) => [m, Array<number>(24).fill(0)])) as Record<Metric, number[]>;

export function emptyDay(): DayStats {
  return { posts: 0, ads: 0, media: 0, words: 0, distancePx: 0, activeMs: 0, likes: 0, reposts: 0, hourly: emptyHourly(), authors: [] };
}

/**
 * Merges a tracker delta into a day. `seen` holds the post ids already counted
 * that day and is updated in place; repeats are ignored.
 */
export function applyDelta(day: DayStats, seen: Set<string>, delta: Delta): DayStats {
  const hourly = { ...emptyHourly(), ...day.hourly };
  const next: DayStats = { ...day, hourly: Object.fromEntries(METRICS.map((m) => [m, [...hourly[m]]])) as DayStats['hourly'] };
  const add = (metric: Metric, n: number) => {
    if (n <= 0) return;
    next[metric] += n;
    next.hourly[metric][delta.hour]! += n;
  };
  const authors = new Set(day.authors);
  for (const post of delta.posts) {
    if (seen.has(post.id)) continue;
    seen.add(post.id);
    add('posts', 1);
    add('ads', post.ad ? 1 : 0);
    add('media', post.media ? 1 : 0);
    add('words', post.words);
    if (post.author && !post.ad && authors.size < MAX_AUTHORS_PER_DAY) authors.add(post.author);
  }
  next.authors = [...authors];
  add('distancePx', delta.distancePx);
  add('activeMs', delta.activeMs);
  add('likes', delta.likes);
  add('reposts', delta.reposts);
  return next;
}

// ─── Dates ────────────────────────────────────────────────────────────────

export function dayKey(date: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}`;
}

export function parseDay(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y!, m! - 1, d!);
}

function addDays(date: Date, n: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

/** Monday-based week start. */
function weekStart(date: Date): Date {
  return addDays(date, -((date.getDay() + 6) % 7));
}

// ─── Ranges and chunks ────────────────────────────────────────────────────

export type Range = 'today' | 'yesterday' | '7d' | '30d' | '1y' | 'all';
export type Grouping = 'hour' | 'day' | 'week' | 'month';

export const RANGE_LABELS: Record<Range, string> = {
  today: 'Today',
  yesterday: 'Yesterday',
  '7d': '7 days',
  '30d': '30 days',
  '1y': 'Year',
  all: 'All time',
};

export function rangeDays(range: Range, today: Date, days: Record<string, DayStats>): string[] {
  const span = { today: 1, yesterday: 1, '7d': 7, '30d': 30, '1y': 365 } as const;
  if (range === 'all') {
    const keys = Object.keys(days).sort();
    if (!keys.length) return [dayKey(today)];
    const out: string[] = [];
    for (let d = parseDay(keys[0]!); d <= today; d = addDays(d, 1)) out.push(dayKey(d));
    return out;
  }
  const end = range === 'yesterday' ? addDays(today, -1) : today;
  return Array.from({ length: span[range] }, (_, i) => dayKey(addDays(end, i - span[range] + 1)));
}

export interface Totals extends Omit<DayStats, 'authors'> {
  uniqueAuthors: number;
  activeDays: number;
}

export function totals(keys: string[], days: Record<string, DayStats>): Totals {
  const out: Totals = { ...emptyDay(), uniqueAuthors: 0, activeDays: 0 };
  const authors = new Set<string>();
  for (const key of keys) {
    const d = days[key];
    if (!d) continue;
    for (const m of METRICS) {
      out[m] += d[m];
      d.hourly[m]?.forEach((n, h) => (out.hourly[m][h]! += n));
    }
    d.authors.forEach((a) => authors.add(a));
    if (d.posts || d.activeMs) out.activeDays++;
  }
  out.uniqueAuthors = authors.size;
  return out;
}

export interface Bucket {
  label: string;
  /** Longer label for tooltips. */
  title: string;
  value: number;
}

export function buckets(keys: string[], days: Record<string, DayStats>, grouping: Grouping, metric: Metric): Bucket[] {
  if (grouping === 'hour') {
    const hours = totals(keys, days).hourly[metric];
    return hours.map((value, h) => ({ label: h % 6 === 0 ? hourLabel(h) : '', title: `${hourLabel(h)}–${hourLabel((h + 1) % 24)}`, value }));
  }
  const groups = new Map<string, Bucket>();
  for (const key of keys) {
    const date = parseDay(key);
    let id: string;
    let label: string;
    let title: string;
    if (grouping === 'day') {
      id = key;
      label = date.toLocaleDateString(undefined, keys.length > 14 ? { day: 'numeric' } : { weekday: 'narrow' });
      title = date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
    } else if (grouping === 'week') {
      const start = weekStart(date);
      id = dayKey(start);
      label = start.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
      title = `Week of ${label}`;
    } else {
      id = key.slice(0, 7);
      label = date.toLocaleDateString(undefined, { month: 'short' });
      title = date.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
    }
    const bucket = groups.get(id) ?? { label, title, value: 0 };
    bucket.value += days[key]?.[metric] ?? 0;
    groups.set(id, bucket);
  }
  return [...groups.values()];
}

export function defaultGrouping(range: Range): Grouping {
  if (range === 'today' || range === 'yesterday') return 'hour';
  if (range === '1y' || range === 'all') return 'month';
  return 'day';
}

export function hourLabel(h: number): string {
  const suffix = h < 12 ? 'a' : 'p';
  return `${h % 12 === 0 ? 12 : h % 12}${suffix}`;
}
