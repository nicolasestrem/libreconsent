import { defineConfig, devices } from "@playwright/test";

const isCi = Boolean(process.env.CI);

export default defineConfig({
  testDir: "./tests",
  fullyParallel: false,
  forbidOnly: isCi,
  retries: isCi ? 1 : 0,
  ...(isCi ? { workers: 1 } : {}),
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: "http://127.0.0.1:4174",
    trace: "on-first-retry",
  },
  webServer: {
    command: "pnpm quickstarts:serve",
    url: "http://127.0.0.1:4174",
    reuseExistingServer: !isCi,
  },
  projects: [
    {
      name: "quickstarts-chromium",
      testMatch: /quickstart-portability\.e2e\.spec\.ts/,
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
