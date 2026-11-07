import { defineConfig } from '@playwright/test';
// Live game acceptance against the running Compose stack (http://localhost:8080). Contexts per player are created in the tests.
export default defineConfig({
 testDir: './tests/live', outputDir: './test-results/live', workers: 1, timeout: 90000,
 expect: { timeout: 10000 }, use: { baseURL: 'http://localhost:8080', trace: 'retain-on-failure' },
});
