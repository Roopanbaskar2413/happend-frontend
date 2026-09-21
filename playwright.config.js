import { defineConfig, devices } from "@playwright/test";

// Backend lives in a sibling repo/directory, not inside this project.
const BACKEND_DIR = new URL("../backend", import.meta.url).pathname;
const BACKEND_PYTHON = `${BACKEND_DIR}/.venv/bin/uvicorn`;

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false, // tests share one backend SQLite db; parallel writers would race
  retries: process.env.CI ? 1 : 0,
  reporter: [["html", { open: "never" }], ["list"]],
  use: {
    baseURL: "http://localhost:5173",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],
  webServer: [
    {
      command: "npm run dev -- --port 5173",
      url: "http://localhost:5173",
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
    },
    {
      command: `${BACKEND_PYTHON} app.main:app --port 8000`,
      cwd: BACKEND_DIR,
      url: "http://localhost:8000/api/health",
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
    },
  ],
});
