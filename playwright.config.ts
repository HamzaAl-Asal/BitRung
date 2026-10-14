import { defineConfig, devices } from "@playwright/test";

// End-to-end tests run against an already running app, database and Judge0 (see README).
export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  workers: 1, // one judge, shared quotas: keep runs sequential
  timeout: 180_000,
  expect: { timeout: 60_000 },
  reporter: [["list"]],
  use: {
    baseURL: process.env.APP_URL ?? "http://localhost:3000",
    trace: "retain-on-failure",
    contextOptions: { reducedMotion: "reduce" },
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
