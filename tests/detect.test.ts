import { describe, expect, it } from 'vitest';
import { countWords, readPost } from '@/lib/detect';

// Trimmed-down copies of X's post markup: only the attributes Finite reads.
const article = (inner: string) => {
  const el = document.createElement('article');
  el.setAttribute('data-testid', 'tweet');
  el.innerHTML = inner;
  return el;
};

const userName = (handle: string) =>
  `<div data-testid="User-Name"><a href="/${handle}"><span>Display Name</span></a><a href="/${handle}"><span>@${handle}</span></a></div>`;

describe('readPost', () => {
  it('reads a regular post', () => {
    const post = readPost(
      article(`${userName('Jack')}<a href="/Jack/status/20"><time datetime="2006-03-21T20:50:00.000Z">Mar 21</time></a>
        <div data-testid="tweetText"><span>just setting up my twttr</span></div>`),
    );
    expect(post).toEqual({ id: '20', author: 'jack', ad: false, media: false, words: 5 });
  });

  it('uses the outer post id, not a quoted one', () => {
    const post = readPost(
      article(`${userName('a')}<a href="/a/status/111"><time>1h</time></a><div data-testid="tweetText">look</div>
        <div role="link">${userName('b')}<a href="/b/status/222"><time>2h</time></a></div>`),
    );
    expect(post?.id).toBe('111');
  });

  it('detects media', () => {
    const post = readPost(article(`${userName('a')}<a href="/a/status/1"><time>1h</time></a><div data-testid="tweetPhoto"><img></div>`));
    expect(post?.media).toBe(true);
  });

  it('detects ads, which have no timestamp link', () => {
    const post = readPost(article(`${userName('brand')}<div data-testid="tweetText">Buy now</div><div><span>Ad</span></div>`));
    expect(post?.ad).toBe(true);
    expect(post?.id).toMatch(/^h:/);
    expect(readPost(article(`${userName('brand')}<div data-testid="placementTracking"></div><a href="/brand/status/9"><time>x</time></a>`))?.ad).toBe(true);
  });

  it('skips loading placeholders', () => {
    expect(readPost(article('<div></div>'))).toBeNull();
  });
});

describe('countWords', () => {
  it('counts words, including languages without spaces', () => {
    expect(countWords('Hello, world! 2026 is here.')).toBe(5);
    expect(countWords('')).toBe(0);
    expect(countWords('今日はいい天気ですね')).toBeGreaterThan(2);
  });
});
