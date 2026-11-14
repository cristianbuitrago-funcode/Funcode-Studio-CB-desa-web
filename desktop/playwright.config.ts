import { defineConfig } from "@playwright/test";

import { BACKEND_URL, TOKEN } from "./e2e/backend";

// Pruebas de extremo a extremo: interfaz real en un navegador contra el backend real.
// No sustituyen la validación de la ventana de escritorio (ver docs/TESTING.md).
export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:1420",
    viewport: { width: 1320, height: 840 },
    trace: "off",
    locale: "es-CO",
  },
  webServer: {
    command: "pnpm dev",
    url: "http://localhost:1420",
    reuseExistingServer: false,
    env: { VITE_FWA_BACKEND_URL: BACKEND_URL, VITE_FWA_TOKEN: TOKEN },
  },
});
