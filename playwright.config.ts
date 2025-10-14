import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/playwright',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list']],
  use: {
    actionTimeout: 0,
    trace: 'on-first-retry',
    baseURL: process.env.PLAYWRIGHT_TEST_BASE_URL,
  },
});
