import { defineConfig } from "@playwright/test";
import { createHash, randomBytes } from "node:crypto";

const baseURL = process.env.E2E_BASE_URL || "http://127.0.0.1:5173";
const local = ["localhost", "127.0.0.1", "[::1]"].includes(
  new URL(baseURL).hostname,
);
if (local && !process.env.E2E_PARENT_ACTIVATION_TOKEN)
  process.env.E2E_PARENT_ACTIVATION_TOKEN =
    randomBytes(32).toString("base64url");
const activation = process.env.E2E_PARENT_ACTIVATION_TOKEN;

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
    // The test account exists only in the local in-memory store. Never consume
    // the owner's production activation link to run browser checks.
    ...(local && activation
      ? {
          env: {
            PARENT_BOOTSTRAP: JSON.stringify({
              hash: createHash("sha256").update(activation).digest("hex"),
              expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
            }),
          },
        }
      : {}),
    command: process.env.E2E_SERVER_COMMAND || "npm run dev -- --port 5173",
    url: baseURL,
    reuseExistingServer: true,
    timeout: 30000,
  },
});
