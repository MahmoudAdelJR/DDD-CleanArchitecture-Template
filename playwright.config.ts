import { defineConfig, devices } from '@playwright/test';

/**
 * E2E uses the system Chrome channel by default (locally and on GitHub-hosted
 * runners). For CI images without Chrome, run `npx playwright install chromium`
 * and remove the channel override below.
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  expect: { timeout: 5_000 },
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : [['list']],
  use: {
    baseURL: 'http://localhost:4300',
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chrome',
      use: { ...devices['Desktop Chrome'], channel: 'chrome' },
    },
  ],
  webServer: {
    command: 'npx ng serve --port 4300',
    url: 'http://localhost:4300',
    reuseExistingServer: !process.env.CI,
    timeout: 240_000,
  },
});
