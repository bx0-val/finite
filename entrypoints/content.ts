import { browser } from 'wxt/browser';
import { readPost, SELECTORS } from '@/lib/detect';
import { dayKey, type Delta } from '@/lib/stats';

const FLUSH_MS = 5_000;
const TICK_MS = 1_000;
/** Without input for this long, the reader has stepped away. */
const IDLE_AFTER_MS = 60_000;
/** A post counts once at least this much of it has been on screen. */
const VISIBLE_RATIO = 0.5;

export default defineContentScript({
  matches: ['https://x.com/*', 'https://twitter.com/*'],
  runAt: 'document_idle',
  main(ctx) {
    const pending = new Map<string, Delta>();
    /** Ids already sent from this page, so re-renders don't resend them. */
    const sent = new Set<string>();
    const observed = new WeakSet<Element>();

    const bucket = (now = new Date()): Delta => {
      const day = dayKey(now);
      const hour = now.getHours();
      const key = `${day}|${hour}`;
      let delta = pending.get(key);
      if (!delta) pending.set(key, (delta = { day, hour, posts: [], distancePx: 0, activeMs: 0, likes: 0, reposts: 0 }));
      return delta;
    };

    // ── Posts ──────────────────────────────────────────────────────────
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting || entry.intersectionRatio < VISIBLE_RATIO) continue;
          const post = readPost(entry.target);
          // X renders a skeleton first; wait for the real content.
          if (!post) continue;
          io.unobserve(entry.target);
          if (sent.has(post.id)) continue;
          sent.add(post.id);
          bucket().posts.push(post);
        }
      },
      { threshold: [VISIBLE_RATIO] },
    );
    const observeAll = (root: ParentNode) => {
      for (const article of root.querySelectorAll(SELECTORS.post)) {
        if (observed.has(article)) continue;
        observed.add(article);
        io.observe(article);
      }
    };
    const mo = new MutationObserver(() => observeAll(document));
    mo.observe(document.body, { childList: true, subtree: true });
    observeAll(document);

    // ── Distance and activity ──────────────────────────────────────────
    let lastY = window.scrollY;
    let lastInput = Date.now();
    const onInput = () => (lastInput = Date.now());
    ctx.addEventListener(
      window,
      'scroll',
      () => {
        const y = window.scrollY;
        const dy = Math.abs(y - lastY);
        lastY = y;
        // Big jumps are navigation or scroll restoration, not reading.
        if (dy < window.innerHeight * 3) bucket().distancePx += dy;
        onInput();
      },
      { passive: true },
    );
    for (const type of ['wheel', 'keydown', 'pointerdown', 'pointermove', 'touchmove'] as const) {
      ctx.addEventListener(window, type, onInput, { passive: true, capture: true });
    }

    let lastTick = Date.now();
    ctx.setInterval(() => {
      const now = Date.now();
      const elapsed = Math.min(now - lastTick, TICK_MS * 3);
      lastTick = now;
      if (document.visibilityState === 'visible' && document.hasFocus() && now - lastInput < IDLE_AFTER_MS) {
        bucket().activeMs += elapsed;
      }
    }, TICK_MS);

    // ── Likes and reposts ──────────────────────────────────────────────
    ctx.addEventListener(
      document,
      'click',
      (e) => {
        const target = e.target instanceof Element ? e.target : null;
        if (target?.closest(SELECTORS.like)) bucket().likes++;
        else if (target?.closest(SELECTORS.repost)) bucket().reposts++;
      },
      { capture: true },
    );

    // ── Sending ────────────────────────────────────────────────────────
    const flush = () => {
      for (const [key, delta] of pending) {
        pending.delete(key);
        const empty = !delta.posts.length && !delta.distancePx && !delta.activeMs && !delta.likes && !delta.reposts;
        if (empty) continue;
        delta.distancePx = Math.round(delta.distancePx);
        try {
          browser.runtime.sendMessage({ type: 'finite:delta', delta }).catch(() => {});
        } catch {
          // Extension reloaded or updated; this page's tracker is orphaned.
        }
      }
    };
    ctx.setInterval(flush, FLUSH_MS);
    ctx.addEventListener(document, 'visibilitychange', () => document.visibilityState === 'hidden' && flush());
    ctx.addEventListener(window, 'pagehide', flush);
    ctx.onInvalidated(() => {
      io.disconnect();
      mo.disconnect();
    });
  },
});
