import { defineConfig, devices } from '@playwright/test'

// Tests run their own server, on their own port and with their own Vite cache (see
// vite.config.ts), so they can't disturb a `pnpm dev` that's running at the same time.
const PORT = 5183

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
    // Not part of the usual run. For checking something in the browser this project is used in:
    // pnpm exec playwright test <file> --project=firefox
    ...(process.env.LF_E2E_FIREFOX ? [{ name: 'firefox', use: { ...devices['Desktop Firefox'] } }] : []),
  ],
  webServer: {
    // The service worker only exists in a real build, so tests of it run against one.
    command: process.env.LF_E2E_PREVIEW
      ? `pnpm exec vite build && pnpm exec vite preview --port ${PORT} --strictPort`
      : `pnpm exec vite --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: false,
    // Nothing listens on this port, so a test can never reach a real API server and spend
    // real credit. Tests that need the API mock it.
    env: { LF_E2E: '1', API_PORT: '8786' },
  },
})
