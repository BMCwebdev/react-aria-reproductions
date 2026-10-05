import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: './tests', fullyParallel: false, workers: 1,
  reporter: [['list'], ['json', { outputFile: process.env.EXPECT_CANCEL_REASON ? 'evidence/gap-results.json' : 'evidence/playwright-results.json' }]],
  use: { baseURL: 'http://127.0.0.1:4173', viewport: { width: 1200, height: 1000 }, screenshot: 'only-on-failure' },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'], launchOptions: { executablePath: process.env.CHROMIUM_EXECUTABLE_PATH } } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'], launchOptions: { executablePath: process.env.FIREFOX_EXECUTABLE_PATH } } },
  ],
  webServer: { command: 'node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 4173', url: 'http://127.0.0.1:4173', reuseExistingServer: false },
});
