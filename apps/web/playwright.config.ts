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
  ],
  webServer: {
    command: `pnpm exec vite --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: false,
    // Nothing listens on this port, so a test can never reach a real API server and spend
    // real credit. Tests that need the API mock it.
    env: { LF_E2E: '1', API_PORT: '8786' },
  },
})
