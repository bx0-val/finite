import { browser } from 'wxt/browser';
import { clearAll, loadDays } from '@/lib/storage';
import {
  buckets, dayKey, defaultGrouping, hourLabel, METRICS, RANGE_LABELS, rangeDays, totals,
  type DayStats, type Grouping, type Metric, type Range,
} from '@/lib/stats';
import {
  distanceComparison, formatCount, formatDistance, formatDuration, oneIn, percent, readingMinutes, wordsComparison,
} from '@/lib/perspective';

interface ViewState {
  range: Range;
  grouping: Grouping;
  metric: Metric;
}

const PREFS_KEY = 'finite:view';
const RANGES: Range[] = ['today', 'yesterday', '7d', '30d', '1y', 'all'];
const RANGE_SHORT: Record<Range, string> = { today: 'Today', yesterday: 'Yday', '7d': '7D', '30d': '30D', '1y': '1Y', all: 'All' };
const GROUPINGS: { id: Grouping; label: string }[] = [
  { id: 'hour', label: 'Hour' },
  { id: 'day', label: 'Day' },
  { id: 'week', label: 'Week' },
  { id: 'month', label: 'Month' },
];
const METRIC_LABELS: Record<Metric, string> = {
  posts: 'Posts',
  distancePx: 'Distance',
  activeMs: 'Time on X',
  words: 'Words',
  ads: 'Ads',
  media: 'Media',
  likes: 'Likes',
  reposts: 'Reposts',
};

const SVG_NS = 'http://www.w3.org/2000/svg';
/** Hourglass mark. */
const LOGO_PATH = 'M6 3h12M6 21h12M7 3c0 5 10 6 10 9s-10 4-10 9M17 3c0 5-10 6-10 9';

const app = document.getElementById('app')!;
let days: Record<string, DayStats> = {};
let view: ViewState = loadPrefs();

function loadPrefs(): ViewState {
  try {
    const saved = JSON.parse(localStorage.getItem(PREFS_KEY) ?? 'null') as ViewState | null;
    if (saved && RANGES.includes(saved.range) && METRICS.includes(saved.metric)) return saved;
  } catch {
    // Storage unavailable; use defaults.
  }
  return { range: 'today', grouping: 'hour', metric: 'posts' };
}

function setView(patch: Partial<ViewState>) {
  view = { ...view, ...patch };
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(view));
  } catch {
    // Not persisted; fine.
  }
  render();
}

// ─── Rendering ────────────────────────────────────────────────────────────

function h<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Record<string, string> = {}, ...children: (Node | string)[]) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  el.append(...children);
  return el;
}

function render() {
  const today = new Date();
  const keys = rangeDays(view.range, today, days);
  const t = totals(keys, days);

  const header = h('header', { class: 'top' }, brand(), h('div', { class: 'live' }, 'Tracking on X'));
  const ranges = segmented(
    RANGES.map((r) => ({ id: r, label: RANGE_SHORT[r], title: RANGE_LABELS[r] })),
    view.range,
    (range) => setView({ range, grouping: defaultGrouping(range) }),
  );

  if (!t.posts && !t.activeMs && !t.distancePx) {
    app.replaceChildren(header, ranges, empty(view.range), footer());
    return;
  }

  app.replaceChildren(header, ranges, hero(t, keys.length), chart(keys), grid(t), footer());
}

function brand() {
  const svg = document.createElementNS(SVG_NS, 'svg');
  const path = document.createElementNS(SVG_NS, 'path');
  const attrs = { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '2', 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true' };
  Object.entries(attrs).forEach(([k, v]) => svg.setAttribute(k, v));
  path.setAttribute('d', LOGO_PATH);
  svg.append(path);
  return h('div', { class: 'brand' }, svg, 'Finite');
}

function segmented<T extends string>(items: { id: T; label: string; title?: string }[], active: T, onPick: (id: T) => void, small = false) {
  const el = h('div', { class: `seg${small ? ' small' : ''}`, role: 'group' });
  for (const item of items) {
    const b = h('button', { type: 'button', 'aria-pressed': String(item.id === active), title: item.title ?? item.label }, item.label);
    b.addEventListener('click', () => onPick(item.id));
    el.append(b);
  }
  return el;
}

function hero(t: ReturnType<typeof totals>, spanDays: number) {
  const label = view.range === 'today' ? 'posts scrolled past today' : view.range === 'yesterday' ? 'posts scrolled past yesterday' : `posts scrolled past · ${RANGE_LABELS[view.range].toLowerCase()}`;
  const parts: (Node | string)[] = [];
  const distance = distanceComparison(t.distancePx);
  if (distance) parts.push('That’s ', h('b', {}, distance), ' of feed');
  const peak = t.hourly.posts.indexOf(Math.max(...t.hourly.posts));
  if (t.posts >= 10) parts.push(parts.length ? ', mostly around ' : 'Mostly around ', h('b', {}, hourLabel(peak).replace('a', '\u00a0am').replace('p', '\u00a0pm')));
  if (parts.length) parts.push('.');
  const perDay = spanDays > 1 && t.activeDays > 1 ? ` · ${formatCount(t.posts / t.activeDays)} a day` : '';
  return h(
    'section',
    { class: 'hero' },
    h('div', { class: 'big num' }, formatCount(t.posts)),
    h('div', { class: 'label' }, label + perDay),
    ...(parts.length ? [h('div', { class: 'insight' }, ...parts)] : []),
  );
}

function chart(keys: string[]) {
  const data = buckets(keys, days, view.grouping, view.metric);
  const max = Math.max(1, ...data.map((b) => b.value));
  const W = 348;
  const H = 96;
  const gap = data.length > 40 ? 1 : data.length > 16 ? 2 : 4;
  const bw = Math.max(1, (W - gap * (data.length - 1)) / data.length);
  const ns = SVG_NS;
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.setAttribute('preserveAspectRatio', 'none');
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', `${METRIC_LABELS[view.metric]} by ${view.grouping}`);
  const caption = view.grouping === 'hour' ? 'by hour of day' : `by ${view.grouping}`;
  const readout = h('span', { class: 'num' }, caption);

  data.forEach((b, i) => {
    const x = i * (bw + gap);
    const bh = b.value ? Math.max(3, (b.value / max) * (H - 2)) : 2;
    const g = document.createElementNS(ns, 'g');
    const bar = document.createElementNS(ns, 'rect');
    bar.setAttribute('class', `bar${b.value ? ' has' : ''}`);
    Object.entries({ x, y: H - bh, width: bw, height: bh, rx: Math.min(3, bw / 2) }).forEach(([k, v]) => bar.setAttribute(k, String(v)));
    const hit = document.createElementNS(ns, 'rect');
    hit.setAttribute('class', 'hit');
    Object.entries({ x: x - gap / 2, y: 0, width: bw + gap, height: H }).forEach(([k, v]) => hit.setAttribute(k, String(v)));
    g.append(bar, hit);
    g.addEventListener('mouseenter', () => (readout.textContent = `${b.title} · ${formatMetric(view.metric, b.value)}`));
    g.addEventListener('mouseleave', () => (readout.textContent = caption));
    svg.append(g);
  });

  const axis = h('div', { class: 'axis' });
  const step = Math.ceil(data.length / 7);
  data.forEach((b, i) => {
    if (view.grouping === 'hour') axis.append(h('span', {}, b.label));
    else if (i % step === 0) axis.append(h('span', {}, b.label));
  });

  const groupings = GROUPINGS.filter((g) => keys.length >= { hour: 1, day: 2, week: 8, month: 32 }[g.id]);
  const head = h(
    'div',
    { class: 'chart-head' },
    h('div', { class: 'chart-title' }, METRIC_LABELS[view.metric], readout),
    groupings.length > 1 ? segmented(groupings, view.grouping, (grouping) => setView({ grouping }), true) : '',
  );
  return h('section', { class: 'chart' }, head, svg, axis);
}

function formatMetric(metric: Metric, value: number): string {
  if (metric === 'distancePx') return formatDistance(value);
  if (metric === 'activeMs') return formatDuration(value);
  return formatCount(value);
}

function grid(t: ReturnType<typeof totals>) {
  const minutes = t.activeMs / 60_000;
  const pace = minutes >= 1 ? `${formatCount(t.posts / minutes, 1)} posts a minute` : 'just getting started';
  const cards: { metric?: Metric; k: string; v: string; s: string }[] = [
    { metric: 'distancePx', k: 'Distance', v: formatDistance(t.distancePx), s: distanceComparison(t.distancePx) ?? 'of scrolling' },
    { metric: 'activeMs', k: 'Time on X', v: formatDuration(t.activeMs), s: pace },
    {
      metric: 'words',
      k: 'Words passed',
      v: formatCount(t.words),
      s: wordsComparison(t.words) ?? `≈ ${formatDuration(readingMinutes(t.words) * 60_000)} of reading`,
    },
    { metric: 'ads', k: 'Ads', v: formatCount(t.ads), s: `${percent(t.ads, t.posts)} of your feed` },
    { metric: 'media', k: 'Photos & video', v: percent(t.media, t.posts), s: `${formatCount(t.media)} posts with media` },
    { metric: 'likes', k: 'Likes', v: formatCount(t.likes), s: oneIn(t.likes, t.posts) ? `${oneIn(t.likes, t.posts)} posts` : 'none given' },
    { metric: 'reposts', k: 'Reposts', v: formatCount(t.reposts), s: oneIn(t.reposts, t.posts) ? `${oneIn(t.reposts, t.posts)} posts` : 'none' },
    { k: 'Accounts', v: formatCount(t.uniqueAuthors), s: 'different people & brands' },
  ];
  const el = h('section', { class: 'grid' });
  for (const c of cards) {
    const card = h(
      'button',
      { type: 'button', class: `card${c.metric ? '' : ' static'}`, 'aria-pressed': String(c.metric === view.metric) },
      h('div', { class: 'k' }, c.k),
      h('div', { class: 'v num' }, c.v),
      h('div', { class: 's', title: c.s }, c.s),
    );
    if (c.metric) {
      const metric = c.metric;
      card.addEventListener('click', () => setView({ metric: view.metric === metric ? 'posts' : metric }));
    } else card.disabled = true;
    el.append(card);
  }
  return el;
}

function empty(range: Range) {
  const msg =
    range === 'today'
      ? ['Nothing yet today', 'Open X and scroll. Finite counts each post as it comes on screen.']
      : ['No scrolling in this range', 'Try a longer range, or check back later.'];
  return h('section', { class: 'empty' }, h('b', {}, msg[0]!), msg[1]!);
}

function footer() {
  const exportBtn = h('button', { type: 'button', title: 'Download every day as CSV' }, 'Export CSV');
  exportBtn.addEventListener('click', exportCsv);
  const resetBtn = h('button', { type: 'button', class: 'danger', title: 'Delete all stored stats' }, 'Reset');
  resetBtn.addEventListener('click', async () => {
    if (!confirm('Delete all Finite stats on this device? This can’t be undone.')) return;
    await clearAll();
  });
  return h('footer', { class: 'foot' }, h('span', {}, 'Stored only on this device'), h('div', { class: 'actions' }, exportBtn, resetBtn));
}

function exportCsv() {
  const header = ['date', 'posts', 'ads', 'media', 'words', 'distance_m', 'active_minutes', 'likes', 'reposts', 'accounts'];
  const rows = Object.keys(days)
    .sort()
    .map((key) => {
      const d = days[key]!;
      return [key, d.posts, d.ads, d.media, d.words, (d.distancePx * 0.0254 / 96).toFixed(1), (d.activeMs / 60_000).toFixed(1), d.likes, d.reposts, d.authors.length].join(',');
    });
  const blob = new Blob([[header.join(','), ...rows].join('\n')], { type: 'text/csv' });
  const a = h('a', { href: URL.createObjectURL(blob), download: `finite-${dayKey(new Date())}.csv` });
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

// ─── Data ─────────────────────────────────────────────────────────────────

async function refresh() {
  days = await loadDays();
  render();
}

browser.storage.onChanged.addListener((_changes, area) => {
  if (area === 'local') void refresh();
});
void refresh();
