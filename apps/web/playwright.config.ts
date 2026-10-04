import { defineConfig, devices } from "@playwright/test";
import { E2E_ORIGIN, E2E_PORT, e2eEnv } from "./e2e/env";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  timeout: 60_000,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: { baseURL: E2E_ORIGIN, trace: "retain-on-failure" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `pnpm exec next start -p ${E2E_PORT}`,
    url: `${E2E_ORIGIN}/api/health`,
    env: e2eEnv,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
