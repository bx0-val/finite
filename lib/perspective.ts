// Turns raw totals into human-scale comparisons and readable numbers.

/** 1 CSS pixel is defined as 1/96 inch. */
export const METERS_PER_PX = 0.0254 / 96;
const WORDS_PER_PAGE = 275;
const WORDS_PER_MINUTE = 238;

interface Landmark {
  name: string;
  plural: string;
  meters: number;
}

const LANDMARKS: Landmark[] = [
  { name: 'Statue of Liberty', plural: 'Statues of Liberty', meters: 93 },
  { name: 'football pitch', plural: 'football pitches', meters: 105 },
  { name: 'Eiffel Tower', plural: 'Eiffel Towers', meters: 330 },
  { name: 'Burj Khalifa', plural: 'Burj Khalifas', meters: 828 },
  { name: 'Golden Gate Bridge', plural: 'Golden Gate Bridges', meters: 2737 },
  { name: 'marathon', plural: 'marathons', meters: 42_195 },
];

const BOOKS = [
  { name: 'The Old Man and the Sea', words: 26_601 },
  { name: 'The Great Gatsby', words: 47_094 },
  { name: 'the first Harry Potter', words: 76_944 },
  { name: 'Moby-Dick', words: 206_052 },
  { name: 'War and Peace', words: 587_287 },
];

export function meters(px: number): number {
  return px * METERS_PER_PX;
}

export function formatDistance(px: number): string {
  const m = meters(px);
  if (m < 1) return `${Math.round(m * 100)} cm`;
  if (m < 1000) return `${m < 10 ? m.toFixed(1) : Math.round(m)} m`;
  return `${(m / 1000).toFixed(m < 10_000 ? 2 : 1)} km`;
}

/** "3.2 Eiffel Towers": the largest landmark the distance covers at least once, else a fraction of the smallest. */
export function distanceComparison(px: number): string | null {
  const m = meters(px);
  if (m < 1) return null;
  const landmark = [...LANDMARKS].reverse().find((l) => m >= l.meters) ?? LANDMARKS[0]!;
  const n = m / landmark.meters;
  if (n < 1) return `${Math.round(n * 100)}% of the height of the ${landmark.name}`;
  return `${formatCount(n, 1)} ${n < 1.05 ? landmark.name : landmark.plural}`;
}

export function wordsComparison(words: number): string | null {
  if (words < WORDS_PER_PAGE) return null;
  const book = [...BOOKS].reverse().find((b) => words >= b.words);
  if (book) return `${formatCount(words / book.words, 1)}× ${book.name}`;
  return `${formatCount(words / WORDS_PER_PAGE)} book pages`;
}

export function readingMinutes(words: number): number {
  return words / WORDS_PER_MINUTE;
}

export function formatDuration(ms: number): string {
  const minutes = Math.round(ms / 60_000);
  if (minutes < 1) return ms > 0 ? '<1m' : '0m';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h >= 24) return `${Math.floor(h / 24)}d ${h % 24}h`;
  return h ? `${h}h ${m}m` : `${m}m`;
}

/** 1234 → "1,234"; 12345 → "12.3k"; 1.5e6 → "1.5M". */
export function formatCount(n: number, decimals = 0): string {
  if (n >= 1e6) return `${trim((n / 1e6).toFixed(1))}M`;
  if (n >= 1e4) return `${trim((n / 1e3).toFixed(1))}k`;
  return n.toLocaleString('en-US', { maximumFractionDigits: decimals, minimumFractionDigits: 0 });
}

function trim(s: string): string {
  return s.replace(/\.0$/, '');
}

export function percent(part: number, whole: number): string {
  if (!whole) return '0%';
  const p = (part / whole) * 100;
  return `${p < 10 && p > 0 ? p.toFixed(1) : Math.round(p)}%`;
}

/** "1 in 143": how many posts per like. */
export function oneIn(part: number, whole: number): string | null {
  if (!part || !whole) return null;
  return `1 in ${formatCount(Math.round(whole / part))}`;
}
