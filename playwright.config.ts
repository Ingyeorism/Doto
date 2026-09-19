import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./scripts",
  testMatch: /(?:classroom|diagnostics|tablet-host|usage-consent|classroom-upgrade|adaptive-sync)\.spec\.ts/,
  workers: 1,
  timeout: 120000,
  expect: { timeout: 15000 },
  use: {
    baseURL: "http://localhost:3100",
    browserName: "chromium",
    channel: "chrome",
    headless: true,
    viewport: { width: 1440, height: 1000 },
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "localhost" },
    {
      name: "http-lan",
      use: {
        baseURL: "http://doto.test:3100",
        launchOptions: {
          args: [
            "--host-resolver-rules=MAP doto.test 127.0.0.1",
            "--no-proxy-server",
          ],
        },
      },
    },
  ],
  webServer: {
    command: "node server/index.mjs",
    env: {
      PORT: "3100",
      HOST: "127.0.0.1",
      LOG_DIR: "test-results/diagnostics",
      DOTO_ADMIN_TOKEN: "isolated-playwright-test-secret-123456",
      DOTO_TUNING_FILE: "test-results/server-tuning.json",
    },
    url: "http://localhost:3100/api/health",
    reuseExistingServer: false,
    timeout: 20000,
  },
});
