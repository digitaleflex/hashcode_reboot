import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: [['html', { open: 'never' }], ['list']],
  use: {
    baseURL: process.env.BASE_URL || 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        launchOptions: {
          args: ['--js-flags=--max-old-space-size=4096', '--disable-dev-shm-usage'],
        },
      },
    },
  ],
  // Don't start a web server - assume one is already running on localhost:3000
  // webServer: {
  //   command: process.env.CI ? 'npm run start' : 'npm run dev',
  //   url: 'http://localhost:3000',
  //   reuseExistingServer: true, // Always reuse existing server to avoid memory issues
  //   timeout: 120000,
  // },
  // Increase timeout for tests
  timeout: 60000,
  expect: {
    timeout: 10000,
  },
});
