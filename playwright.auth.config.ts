import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
 testDir: './tests/identity', outputDir: './test-results/identity', workers: 1,
 timeout: 30000, expect: { timeout: 10000 },
 use: { baseURL: 'http://localhost:8080', trace: 'off' }, // Auth traces would retain credentials/tokens.
 projects: [
  { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
  { name: 'mobile', use: { ...devices['iPhone 13'], defaultBrowserType: 'chromium' } },
 ],
});
