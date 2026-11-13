import { defineConfig, devices } from '@playwright/test';

/**
 * Config dédiée aux audits d'accessibilité axe-core (`tests/a11y`).
 *
 * Pourquoi une config séparée : `playwright.config.ts` a `testDir: './tests/e2e'`,
 * donc les specs `tests/a11y/*.spec.ts` n'étaient exécutées par AUCUNE commande
 * (ni `npm run test:e2e`, ni la CI). Ce fichier leur donne une porte d'entrée
 * explicite : `npm run test:a11y`.
 *
 * Le reste (webServer, baseURL, navigateur) est aligné sur la config E2E.
 */
export default defineConfig({
  testDir: './tests/a11y',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
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
      name: 'chromium-a11y',
      use: {
        ...devices['Desktop Chrome'],
        launchOptions: {
          args: ['--js-flags=--max-old-space-size=4096', '--disable-dev-shm-usage'],
        },
      },
    },
  ],
  webServer: {
    command: process.env.CI ? 'npm run start' : 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: true,
    timeout: 240000,
  },
  timeout: 60000,
  expect: {
    timeout: 10000,
  },
});
