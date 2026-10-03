import { browser } from 'wxt/browser';
import { pruneSeen, recordDelta } from '@/lib/storage';
import type { Delta } from '@/lib/stats';

// The single writer: every X tab sends its deltas here.
export default defineBackground(() => {
  browser.runtime.onMessage.addListener((message: { type?: string; delta?: Delta }) => {
    if (message?.type === 'finite:delta' && message.delta) void recordDelta(message.delta);
  });
  browser.runtime.onStartup.addListener(() => void pruneSeen());
  browser.runtime.onInstalled.addListener(() => void pruneSeen());
});
