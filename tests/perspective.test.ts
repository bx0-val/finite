import { describe, expect, it } from 'vitest';
import { distanceComparison, formatCount, formatDistance, formatDuration, METERS_PER_PX, oneIn, percent, wordsComparison } from '@/lib/perspective';

const px = (meters: number) => meters / METERS_PER_PX;

describe('perspective', () => {
  it('formats distance', () => {
    expect(formatDistance(px(0.42))).toBe('42 cm');
    expect(formatDistance(px(5.25))).toBe('5.3 m');
    expect(formatDistance(px(412))).toBe('412 m');
    expect(formatDistance(px(1420))).toBe('1.42 km');
  });

  it('compares distance with the largest landmark it covers', () => {
    expect(distanceComparison(px(0.5))).toBeNull();
    expect(distanceComparison(px(46.5))).toBe('50% of the height of the Statue of Liberty');
    expect(distanceComparison(px(990))).toBe('1.2 Burj Khalifas');
    expect(distanceComparison(px(660))).toBe('2 Eiffel Towers');
    expect(distanceComparison(px(333))).toBe('1 Eiffel Tower');
  });

  it('compares words with books', () => {
    expect(wordsComparison(100)).toBeNull();
    expect(wordsComparison(2750)).toBe('10 book pages');
    expect(wordsComparison(94_188)).toBe('1.2× the first Harry Potter');
  });

  it('formats durations, counts and ratios', () => {
    expect(formatDuration(0)).toBe('0m');
    expect(formatDuration(20_000)).toBe('<1m');
    expect(formatDuration(134 * 60_000)).toBe('2h 14m');
    expect(formatDuration(26 * 3_600_000)).toBe('1d 2h');
    expect(formatCount(1234)).toBe('1,234');
    expect(formatCount(12_345)).toBe('12.3k');
    expect(formatCount(2_000_000)).toBe('2M');
    expect(percent(9, 100)).toBe('9.0%');
    expect(percent(0, 0)).toBe('0%');
    expect(oneIn(3, 429)).toBe('1 in 143');
    expect(oneIn(0, 10)).toBeNull();
  });
});
