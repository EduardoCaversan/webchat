import { defineConfig } from '@playwright/test';

// Uses the actual compiled frontend and Auth Emulator popup exposed by Compose.
// Unlike the development suite, no browser auth helper or Vite server is used.
export default defineConfig({
  testDir: './tests/docker',
  timeout: 60000,
  expect: { timeout: 15000 },
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
});
