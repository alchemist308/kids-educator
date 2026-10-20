import { defineConfig } from "@playwright/test";

const baseURL = process.env.E2E_BASE_URL || "http://127.0.0.1:5173";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 60000,
  expect: { timeout: 12000 },
  reporter: [["list"]],
  use: {
    baseURL,
    viewport: { width: 1440, height: 1000 },
    locale: "ru-RU",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    launchOptions: {
      executablePath:
        process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || "/usr/bin/chromium",
      args: ["--no-sandbox"],
    },
  },
  webServer: {
    command: process.env.E2E_SERVER_COMMAND || "npm run dev -- --port 5173",
    url: baseURL,
    reuseExistingServer: true,
    timeout: 30000,
  },
});
