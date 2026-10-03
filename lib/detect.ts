import type { SeenPost } from './stats';

// Reads what Finite needs from one post on X. Selectors are X's own
// data-testid attributes, which are more stable than its generated class names.
export const SELECTORS = {
  post: 'article[data-testid="tweet"]',
  text: '[data-testid="tweetText"]',
  userName: '[data-testid="User-Name"]',
  media: '[data-testid="tweetPhoto"], [data-testid="videoPlayer"], [data-testid="videoComponent"], [data-testid="previewInterstitial"]',
  adTracking: '[data-testid="placementTracking"]',
  like: '[data-testid="like"]',
  repost: '[data-testid="retweetConfirm"]',
};

const AD_LABELS = new Set(['Ad', 'Promoted']);

export function readPost(article: Element): SeenPost | null {
  const author = authorOf(article);
  const ad = isAd(article);
  const text = article.querySelector(SELECTORS.text)?.textContent ?? '';
  const id = postId(article) ?? (ad || text || author ? `h:${hash(`${author}|${text}`)}` : null);
  if (!id) return null;
  return { id, author, ad, media: !!article.querySelector(SELECTORS.media), words: countWords(text) };
}

/** The status id from the post's own timestamp link (the first one; later ones belong to quoted posts). */
function postId(article: Element): string | null {
  const href = article.querySelector('time')?.closest('a')?.getAttribute('href') ?? '';
  return /\/status\/(\d+)/.exec(href)?.[1] ?? null;
}

function authorOf(article: Element): string | null {
  for (const a of article.querySelectorAll(`${SELECTORS.userName} a[href^="/"]`)) {
    const handle = /^\/([A-Za-z0-9_]{1,15})$/.exec(a.getAttribute('href') ?? '')?.[1];
    if (handle) return handle.toLowerCase();
  }
  return null;
}

function isAd(article: Element): boolean {
  if (article.querySelector(SELECTORS.adTracking)) return true;
  if (article.querySelector('time')) return false;
  return [...article.querySelectorAll('span')].some((s) => s.children.length === 0 && AD_LABELS.has(s.textContent?.trim() ?? ''));
}

const segmenter = typeof Intl !== 'undefined' && 'Segmenter' in Intl ? new Intl.Segmenter(undefined, { granularity: 'word' }) : null;

/** Word count that also works for languages written without spaces. */
export function countWords(text: string): number {
  if (!text.trim()) return 0;
  if (segmenter) {
    let n = 0;
    for (const s of segmenter.segment(text)) if (s.isWordLike) n++;
    return n;
  }
  return text.match(/[\p{L}\p{N}]+/gu)?.length ?? 0;
}

function hash(s: string): string {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return (h >>> 0).toString(36);
}
