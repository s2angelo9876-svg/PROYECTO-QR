import { defineConfig, devices } from '@playwright/test';
import { existsSync } from 'node:fs';

export default defineConfig({
  testDir: './tests/e2e', fullyParallel: false, workers: 1, retries: 0,
  forbidOnly: !!process.env.CI, timeout: 45_000, reporter: 'list',
  use: {
    baseURL: 'http://localhost:3100', ...devices['Desktop Chrome'],
    launchOptions: existsSync('/usr/bin/chromium') ? { executablePath: '/usr/bin/chromium' } : {},
    screenshot: 'only-on-failure', trace: 'retain-on-failure',
  },
  webServer: { command: 'node scripts/start-e2e.mjs', url: 'http://localhost:3100/api/health',
    reuseExistingServer: false, timeout: 30_000 },
});
