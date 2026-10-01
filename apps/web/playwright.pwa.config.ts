import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: './e2e/pwa', timeout: 60_000, workers: 1,
  use: { ...devices['Desktop Chrome'], baseURL: 'http://127.0.0.1:4173', trace: 'retain-on-failure' },
  webServer: { command: 'pnpm exec vite preview --host 0.0.0.0 --port 4173 --strictPort', url: 'http://127.0.0.1:4173', reuseExistingServer: false },
});
