import { defineConfig, devices } from "@playwright/test";
import { existsSync } from "node:fs";
export default defineConfig({
  testDir: "./tests/institution-e2e",
  workers: 1,
  retries: 0,
  forbidOnly: !!process.env.CI,
  timeout: 45000,
  reporter: "list",
  outputDir: "test-results/institution",
  use: {
    baseURL: "http://localhost:3101",
    ...devices["Desktop Chrome"],
    launchOptions: existsSync("/usr/bin/chromium")
      ? { executablePath: "/usr/bin/chromium" }
      : {},
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "node scripts/start-institution-e2e.mjs",
    url: "http://localhost:3101/api/ready",
    timeout: 60000,
    reuseExistingServer: false,
  },
});
