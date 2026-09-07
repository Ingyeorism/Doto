import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./scripts",
  testMatch: /(?:classroom|diagnostics)\.spec\.ts/,
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
    },
    url: "http://localhost:3100/api/health",
    reuseExistingServer: false,
    timeout: 20000,
  },
});
