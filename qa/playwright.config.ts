import { defineConfig } from '@playwright/test'

/**
 * QA batch 1 config — multi-browser buyer/guest flows against the Factory Bay
 * storefront dev server (http://localhost:3000).
 *
 * The config file lives in qa/, so testDir '.' == the qa/ directory
 * (equivalent to "testDir qa" when invoked from the repo root).
 *
 * Dev server is expected to already be running (reuseExistingServer); when it
 * is not, `npm run dev` is booted with the docker-compose Neo4j password
 * forwarded (same arrangement as apps/factorybay/playwright.config.ts).
 */
export default defineConfig({
  testDir: '.',
  outputDir: './test-results',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:3000',
    screenshot: 'only-on-failure',
    trace: 'off',
    actionTimeout: 15_000,
  },
  projects: [
    { name: 'chromium', use: { browserName: 'chromium' } },
    { name: 'firefox', use: { browserName: 'firefox' } },
    { name: 'webkit', use: { browserName: 'webkit' } },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: true,
    timeout: 120_000,
    env: {
      ...process.env,
      NEO4J_PASSWORD: process.env.NEO4J_PASSWORD || 'ecommerce123',
    } as Record<string, string>,
  },
})
