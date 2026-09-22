import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: './tests/e2e',
  timeout: 60000,
  expect: { timeout: 15000 },
  fullyParallel: false,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://127.0.0.1:5173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 5173 --strictPort',
    url: 'http://127.0.0.1:5173',
    reuseExistingServer: false,
    env: {
      VITE_FIREBASE_API_KEY: 'demo-api-key',
      VITE_FIREBASE_PROJECT_ID: 'demo-entre',
      VITE_FIREBASE_AUTH_DOMAIN: 'demo-entre.firebaseapp.com',
      VITE_FIREBASE_APP_ID: '1:123456789:web:demo',
      VITE_FIREBASE_FUNCTIONS_REGION: 'southamerica-east1',
      VITE_USE_EMULATORS: 'true',
    },
  },
});
