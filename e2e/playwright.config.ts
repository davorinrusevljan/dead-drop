import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: '.',
  testMatch: '**/*.spec.ts',
  testIgnore: ['**/node_modules/**', '**/packages/**', '**/apps/**'],
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:3010',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
  ],
  // Playwright owns the dev-stack lifecycle: starts API (:9090) + UI (:3010)
  // itself, reuses healthy servers, replaces nothing silently.
  // Run from repo root: `pnpm dev:up` first if you want your own servers.
  // Paths are relative to this config's dir (e2e/).
  // Admin API health is UNVERSIONED /api/health (admin API has no /v1 prefix).
  webServer: [
    {
      command: 'cd ../apps/core && pnpm dev:api',
      url: 'http://localhost:9090/api/v1/health',
      reuseExistingServer: true,
      timeout: 60_000,
    },
    {
      command: 'cd ../apps/core && pnpm dev',
      url: 'http://localhost:3010',
      reuseExistingServer: true,
      timeout: 120_000,
    },
    {
      command: 'cd ../apps/admin && pnpm dev:api',
      url: 'http://localhost:9091/api/health',
      reuseExistingServer: true,
      timeout: 60_000,
    },
    {
      command: 'cd ../apps/admin && pnpm dev',
      // / redirects 307→/login→308→/login/; readiness needs a direct 200
      url: 'http://localhost:3011/login/',
      reuseExistingServer: true,
      timeout: 120_000,
    },
  ],
});
