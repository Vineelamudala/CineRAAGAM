import { defineConfig, devices } from '@playwright/test';

const PORT = Number(process.env.E2E_PORT ?? 3100);

export default defineConfig({
  testDir: './e2e',
  // Needs the local Supabase stack + .env.local (npm run db:start && npm run env:local).
  globalSetup: './e2e/global-setup.ts',
  fullyParallel: true,
  // The local Supabase stack, the Next server and the browsers share one machine;
  // too many parallel browsers starve the CPU and make timing-based waits flaky.
  workers: 3,
  expect: { timeout: 10_000 },
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
    launchOptions: { args: ['--autoplay-policy=no-user-gesture-required'] },
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
  // Runs against a production build: `npm run build` first.
  webServer: {
    command: `npx next start -p ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
  },
});
