import { defineConfig, devices } from "@playwright/test";

// E2E de rendimiento: corren contra el BUILD de produccion servido con
// `vite preview` (no contra el dev server), porque lo que importa es el
// bundle real (chunks, code-splitting, precache). Supabase se mockea en cada
// test (ver e2e/helpers.ts): no hace falta backend ni credenciales reales.
//
//   npm run build && npm run test:e2e
//
// Local: usa el Chrome instalado (no baja navegadores). En CI (CI=true) usa el
// Chromium de Playwright (`npx playwright install --with-deps chromium`).

const PORT = 4173;

export default defineConfig({
  testDir: "./e2e",
  testMatch: /.*\.e2e\.ts/,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
    // El service worker cachea JS: lo bloqueamos para medir la red real.
    serviceWorkers: "block",
  },
  projects: [
    {
      name: "mobile-chrome",
      use: {
        ...devices["Pixel 7"],
        ...(process.env.CI ? {} : { channel: "chrome" }),
      },
    },
  ],
  webServer: {
    command: `npx vite preview --port ${PORT} --strictPort`,
    port: PORT,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
