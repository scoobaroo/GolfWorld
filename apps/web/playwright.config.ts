import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: './e2e', testMatch: ['slice.spec.ts', 'geo.spec.ts', 'capture.spec.ts'], timeout: 90_000, workers: 1,
  use: { baseURL: 'http://127.0.0.1:5174', trace: 'retain-on-failure' },
  projects: [
    { name: 'desktop-chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile-chromium', use: { ...devices['Pixel 7'], viewport: { width: 390, height: 844 } } },
    { name: 'mobile-webkit', use: { ...devices['iPhone 13'], viewport: { width: 390, height: 844 } } },
    { name: 'mobile-tablet-webkit', use: { ...devices['iPad Mini'] } },
  ],
  // Isolate deterministic keyless fixtures from the user's live Google configuration.
  webServer: { command: 'pnpm dev --port 5174', url: 'http://127.0.0.1:5174', reuseExistingServer: false, timeout: 60_000, env: { VITE_ADDRESS_SEARCH_PROVIDER: 'photon' } },
});
