import { defineConfig } from '@playwright/test';
import base from './playwright.config';
export default defineConfig({ ...base, testMatch: ['google-geo.spec.ts'],
  use: { ...base.use, baseURL: 'http://127.0.0.1:5175' },
  webServer: { command: 'pnpm dev --port 5175', url: 'http://127.0.0.1:5175', reuseExistingServer: false, timeout: 60_000,
    env: { VITE_ADDRESS_SEARCH_PROVIDER: 'google', VITE_GOOGLE_MAPS_API_KEY: 'golfworld-test-key-not-a-real-key' } },
});
