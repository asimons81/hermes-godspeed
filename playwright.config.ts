import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30000,
  expect: {
    timeout: 8000
  },
  webServer: {
    command: 'npm run build:test && npm run preview -- --host 127.0.0.1 --port 5184',
    url: 'http://127.0.0.1:5184/?skipIntro=1',
    reuseExistingServer: false,
    timeout: 60000
  },
  use: {
    baseURL: 'http://127.0.0.1:5184',
    trace: 'retain-on-failure'
  },
  projects: [
    {
      name: 'desktop',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 720 }
      }
    },
    {
      name: 'mobile',
      use: {
        ...devices['Pixel 5'],
        viewport: { width: 390, height: 844 }
      }
    }
  ]
});
