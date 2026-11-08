import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/docs',
  outputDir: './test-results/docs',
  workers: 2,
  timeout: 20000,
  expect: { timeout: 12000 },
  use: { browserName: 'chromium', trace: 'retain-on-failure' },
});
