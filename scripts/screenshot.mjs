// Renders the popup with demo data and saves docs/screenshot-{dark,light}-{range}.png.
// Usage: npm run screenshot   (needs Chrome; set CHROME_PATH if not /usr/bin/google-chrome)
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';
import { createServer } from 'vite';

const root = fileURLToPath(new URL('..', import.meta.url));
const server = await createServer({
  root: `${root}/entrypoints/popup`,
  configFile: false,
  logLevel: 'error',
  resolve: { alias: { 'wxt/browser': `${root}/scripts/mock-browser.ts`, '@': root } },
  server: { port: 5299, strictPort: true },
});
await server.listen();
const browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH ?? '/usr/bin/google-chrome', args: ['--no-sandbox'] });

try {
  const shots = [
    { theme: 'dark', range: 'today', metric: 'posts', grouping: 'hour' },
    { theme: 'dark', range: '30d', metric: 'posts', grouping: 'day' },
    { theme: 'light', range: '7d', metric: 'distancePx', grouping: 'day' },
  ];
  for (const shot of shots) {
    const page = await browser.newPage();
    await page.setViewport({ width: 380, height: 600, deviceScaleFactor: 2 });
    await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: shot.theme }]);
    await page.evaluateOnNewDocument((view) => localStorage.setItem('finite:view', JSON.stringify(view)), shot);
    page.on('pageerror', (e) => console.error('page error:', e.message));
    await page.goto('http://localhost:5299/', { waitUntil: 'networkidle0' });
    await page.waitForSelector('.hero');
    const body = await page.$('body');
    const file = `docs/screenshot-${shot.theme}-${shot.range}.png`;
    await body.screenshot({ path: `${root}/${file}` });
    console.log('wrote', file);
    await page.close();
  }
} finally {
  await browser.close();
  await server.close();
}

// Compose docs/hero.png: the three screenshots on a warm gradient, for the README.
import { readFileSync } from 'node:fs';
const img = (f) => `data:image/png;base64,${readFileSync(`${root}/docs/${f}`).toString('base64')}`;
const heroBrowser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH ?? '/usr/bin/google-chrome', args: ['--no-sandbox'] });
try {
  const page = await heroBrowser.newPage();
  await page.setViewport({ width: 1400, height: 1000, deviceScaleFactor: 1.5 });
  await page.setContent(`<!doctype html><html><body style="margin:0">
    <div id="hero" style="width:1400px;height:1000px;display:flex;align-items:center;justify-content:center;gap:44px;
      background:radial-gradient(1200px 600px at 20% 0%,#ff9a62 0%,rgba(255,154,98,0) 60%),radial-gradient(900px 600px at 100% 100%,#c2410c 0%,rgba(194,65,12,0) 60%),#1a0f0a;">
      ${['screenshot-dark-today.png', 'screenshot-dark-30d.png', 'screenshot-light-7d.png']
        .map((f, i) => `<img src="${img(f)}" style="width:380px;border-radius:18px;box-shadow:0 30px 80px rgba(0,0,0,.45),0 0 0 1px rgba(255,255,255,.08);transform:translateY(${i === 1 ? -18 : 18}px)">`)
        .join('')}
    </div></body></html>`);
  await (await page.$('#hero')).screenshot({ path: `${root}/docs/hero.png` });
  console.log('wrote docs/hero.png');
} finally {
  await heroBrowser.close();
}
