import { defineConfig, devices } from "@playwright/test";

const browserChannel = process.env.E2E_BROWSER_CHANNEL ?? (process.platform === "win32" ? "msedge" : undefined);

export default defineConfig({
  testDir: ".",
  testMatch: /full-flow\.spec\.ts/,
  timeout: 180_000,
  expect: {
    timeout: 15_000,
  },
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  reporter: [
    ["list"],
    ["html", { outputFolder: ".playwright-report", open: "never" }],
  ],
  outputDir: ".test-results",
  use: {
    baseURL: process.env.E2E_FRONTEND_URL ?? "http://localhost:5173",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"], ...(browserChannel ? { channel: browserChannel } : {}) },
    },
  ],
});
