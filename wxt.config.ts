import { defineConfig } from 'wxt';

export default defineConfig({
  manifestVersion: 3,
  // Store review needs the code, not the README artwork.
  zip: { excludeSources: ['docs/**'] },
  manifest: ({ browser }) => ({
    name: 'Finite — scroll counter for X',
    short_name: 'Finite',
    description: 'Counts the posts you scroll past on X, plus distance, time and more, in a simple local-only dashboard.',
    permissions: ['storage', 'unlimitedStorage'],
    action: { default_title: 'Finite' },
    browser_specific_settings:
      browser === 'firefox'
        ? ({
            gecko: {
              id: 'finite@bx0-val.github.io',
              strict_min_version: '115.0',
              data_collection_permissions: { required: ['none'] },
            },
          } as Record<string, unknown>)
        : undefined,
  }),
});
