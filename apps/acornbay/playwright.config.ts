import { defineConfig } from '@playwright/test'

/**
 * Pilot specs for the acornbay storefront (Phase 6 Task 3).
 *
 * Prerequisites:
 * - THIS tenant's Neo4j container up:
 *     docker compose -f docker-compose.acornbay.yml up -d
 *   (or `docker start ecom-acornbay-neo4j`) with the committed seed applied
 *   (`scripts/seed-client.cypher` — `npm run new-client -- --client acornbay`
 *   is idempotent and re-applies it).
 * - No MinIO, no factorybay, nothing else: this app is catalog-only.
 *
 * The webServer env below mirrors `apps/acornbay/.env.local.example` so the
 * specs run even without a local `.env.local` (Next would load one if
 * present; explicit env wins either way). Set PILOT_BASE_URL to point at an
 * already-running instance instead of letting Playwright boot `npm run dev`.
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  use: { baseURL: process.env.PILOT_BASE_URL || 'http://localhost:3100' },
  webServer: process.env.PILOT_BASE_URL
    ? undefined
    : {
        command: 'npm run dev',
        url: 'http://localhost:3100',
        reuseExistingServer: true,
        timeout: 120_000,
        env: {
          ...process.env,
          CLIENT_ID: 'acornbay',
          NEO4J_URI: 'neo4j://localhost:7601',
          NEO4J_USER: 'neo4j',
          NEO4J_PASSWORD: 'acornbay123',
          DEFAULT_CURRENCY: 'LKR',
        } as Record<string, string>,
      },
})
