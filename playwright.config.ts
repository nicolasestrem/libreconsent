import { defineConfig } from "@playwright/test";

const isCi = Boolean(process.env.CI);

export default defineConfig({
  testDir: "./tests",
  fullyParallel: false,
  forbidOnly: isCi,
  retries: isCi ? 1 : 0,
  ...(isCi ? { workers: 1 } : {}),
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: "http://127.0.0.1:4173",
    trace: "on-first-retry",
  },
  webServer: {
    command: "pnpm examples:serve",
    url: "http://127.0.0.1:4173",
    reuseExistingServer: !isCi,
  },
  projects: [
    {
      name: "e2e",
      testMatch: /.*\.e2e\.spec\.ts/,
    },
    {
      name: "a11y",
      testMatch: /.*\.a11y\.spec\.ts/,
    },
  ],
});
