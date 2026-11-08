import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
 testDir: './tests/quizzes', outputDir: './test-results/quizzes', workers: 1, timeout: 60000,
 expect: { timeout: 10000 }, use: { baseURL: 'http://localhost:8080', trace: 'off' },
 projects: [
  { name: 'api', testMatch: 'api.spec.ts' },
  { name: 'desktop', testMatch: 'browser.spec.ts', use: { ...devices['Desktop Chrome'] } },
  { name: 'mobile', testMatch: 'browser.spec.ts', use: { ...devices['iPhone 13'], defaultBrowserType: 'chromium' } },
 ],
});
