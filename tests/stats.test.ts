import { describe, expect, it } from 'vitest';
import { applyDelta, buckets, dayKey, emptyDay, rangeDays, totals, type DayStats, type Delta, type SeenPost } from '@/lib/stats';

const post = (id: string, extra: Partial<SeenPost> = {}): SeenPost => ({ id, author: 'alice', ad: false, media: false, words: 10, ...extra });
const delta = (extra: Partial<Delta> = {}): Delta => ({ day: '2026-10-04', hour: 9, posts: [], distancePx: 0, activeMs: 0, likes: 0, reposts: 0, ...extra });

describe('applyDelta', () => {
  it('counts each post once per day', () => {
    const seen = new Set<string>();
    let day = applyDelta(emptyDay(), seen, delta({ posts: [post('1'), post('2', { author: 'bob', media: true })] }));
    day = applyDelta(day, seen, delta({ hour: 10, posts: [post('2'), post('3', { ad: true, author: 'brand' })] }));
    expect(day.posts).toBe(3);
    expect(day.ads).toBe(1);
    expect(day.media).toBe(1);
    expect(day.words).toBe(30);
    expect(day.hourly.posts[9]).toBe(2);
    expect(day.hourly.posts[10]).toBe(1);
    // Advertisers don't count as accounts you saw.
    expect(day.authors.sort()).toEqual(['alice', 'bob']);
  });

  it('adds activity to totals and the hour', () => {
    const day = applyDelta(emptyDay(), new Set(), delta({ hour: 22, distancePx: 960, activeMs: 5000, likes: 2, reposts: 1 }));
    expect([day.distancePx, day.activeMs, day.likes, day.reposts]).toEqual([960, 5000, 2, 1]);
    expect(day.hourly.distancePx[22]).toBe(960);
    expect(day.hourly.activeMs[22]).toBe(5000);
  });

  it('ignores negative values and does not mutate its input', () => {
    const base = emptyDay();
    const next = applyDelta(base, new Set(), delta({ distancePx: -50, posts: [post('1')] }));
    expect(next.distancePx).toBe(0);
    expect(base.posts).toBe(0);
    expect(base.hourly.posts[9]).toBe(0);
  });
});

describe('ranges and chunking', () => {
  const today = new Date(2026, 9, 4); // Sun 4 Oct 2026
  const days: Record<string, DayStats> = {};
  const seed = (key: string, posts: number, hour = 12) => {
    days[key] = applyDelta(emptyDay(), new Set(), delta({ day: key, hour, posts: Array.from({ length: posts }, (_, i) => post(`${key}-${i}`)) }));
  };
  seed('2026-10-04', 5, 8);
  seed('2026-10-03', 3, 21);
  seed('2026-09-28', 2);
  seed('2026-08-15', 7);

  it('lists the days in each range', () => {
    expect(rangeDays('today', today, days)).toEqual(['2026-10-04']);
    expect(rangeDays('yesterday', today, days)).toEqual(['2026-10-03']);
    expect(rangeDays('7d', today, days)).toEqual(['2026-09-28', '2026-09-29', '2026-09-30', '2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04']);
    const all = rangeDays('all', today, days);
    expect(all[0]).toBe('2026-08-15');
    expect(all.at(-1)).toBe('2026-10-04');
    expect(all).toHaveLength(51);
  });

  it('totals a range', () => {
    const t = totals(rangeDays('7d', today, days), days);
    expect(t.posts).toBe(10);
    expect(t.activeDays).toBe(3);
    expect(t.uniqueAuthors).toBe(1);
  });

  it('groups by hour of day, day, week and month', () => {
    const week = rangeDays('7d', today, days);
    const hourly = buckets(week, days, 'hour', 'posts');
    expect(hourly).toHaveLength(24);
    expect([hourly[8]!.value, hourly[12]!.value, hourly[21]!.value]).toEqual([5, 2, 3]);
    expect(buckets(week, days, 'day', 'posts').map((b) => b.value)).toEqual([2, 0, 0, 0, 0, 3, 5]);
    // Mon 28 Sep starts the week holding every day of this range.
    expect(buckets(week, days, 'week', 'posts').map((b) => b.value)).toEqual([10]);
    expect(buckets(rangeDays('all', today, days), days, 'month', 'posts').map((b) => b.value)).toEqual([7, 2, 8]);
  });

  it('uses local dates', () => {
    expect(dayKey(new Date(2026, 0, 2, 23, 59))).toBe('2026-01-02');
  });
});
