# Contributing to Finite

Thanks for helping! Finite aims to stay **small, private and calm**, so changes should keep it that way:

- No network requests, analytics or remote code.
- No new permissions without a strong reason.
- Keep the popup light. It's plain TypeScript and CSS, with no UI framework.

## Getting started

```sh
npm install
npm run dev          # or: npm run dev:firefox
```

Before opening a pull request:

```sh
npm run compile && npm test
```

If you change the dashboard, run `npm run screenshot` and include a screenshot in the PR.

## Common changes

- **X changed its markup and counting broke:** update the selectors in `lib/detect.ts` and the fixtures in `tests/detect.test.ts`.
- **A new perspective comparison:** add it to `lib/perspective.ts` with a test. Real, verifiable figures only, please.
- **A new metric:** add it to `DayStats` and `METRICS` in `lib/stats.ts`, record it in `entrypoints/content.ts`, and add a card in `entrypoints/popup/main.ts`.

## Reporting bugs

Please include your browser and version, which X page you were on, and what the dashboard showed versus what you expected.
