import { defineConfig } from "@playwright/test";

const PORT = 3210;
export default defineConfig({
  testDir: "e2e",
  timeout: 90_000,
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL: process.env.E2E_BASE_URL ?? `http://localhost:${PORT}`,
    viewport: { width: 1440, height: 900 },
    launchOptions: process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {},
  },
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: `pnpm build && pnpm start -p ${PORT}`,
        port: PORT,
        timeout: 240_000,
        reuseExistingServer: true,
        env: { DEMO_PASSWORD: process.env.DEMO_PASSWORD ?? "e2e-pass" },
      },
});
