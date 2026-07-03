import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  retries: process.env.CI ? 1 : 0,
  // Several specs manage shared fixture state (provider2 MFA enrollment);
  // a single worker keeps runs deterministic. The suite stays under ~1 min.
  workers: 1,
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3100",
    trace: "retain-on-failure",
    // Managed environments pre-install Chromium outside Playwright's registry;
    // PW_CHROMIUM_PATH overrides the executable there (unset locally/CI).
    launchOptions: process.env.PW_CHROMIUM_PATH
      ? { executablePath: process.env.PW_CHROMIUM_PATH }
      : undefined,
  },
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: "pnpm start -p 3100",
        url: "http://localhost:3100/api/health",
        reuseExistingServer: true,
        timeout: 60_000,
      },
});
