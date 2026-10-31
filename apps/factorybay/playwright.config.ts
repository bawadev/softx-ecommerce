import { defineConfig } from '@playwright/test'

/**
 * Playwright smoke configuration for the Factory Bay storefront.
 *
 * Prerequisites for a local run (see CLAUDE.md "Monorepo & Contract"):
 * - Neo4j up (`docker compose up -d neo4j`) with seeded products.
 *   NOTE: the repo's product seed scripts (`scripts/seed-test-products.ts`,
 *   `scripts/seed-locked-v4.ts`, ...) upload images to MinIO, which is not
 *   available in every dev environment. When MinIO is down, seed the same
 *   product fixtures directly via cypher-shell (documented in the smoke spec
 *   header) — image URLs are not asserted, only product text.
 * - No MinIO needed for the shop listing itself (image URLs render as broken
 *   images; assertions are on text only).
 *
 * Set SMOKE_BASE_URL to point at an already-running app instance instead of
 * letting Playwright boot `npm run dev`.
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  use: { baseURL: process.env.SMOKE_BASE_URL || 'http://localhost:3000' },
  webServer: process.env.SMOKE_BASE_URL
    ? undefined
    : {
        command: 'npm run dev',
        url: 'http://localhost:3000',
        reuseExistingServer: true,
        timeout: 120_000,
        // The dev server talks to the engine (Neo4j). There is no committed
        // .env.local, so forward the invoking shell's env (falling back to the
        // docker-compose Neo4j password) into the booted `next dev` process.
        env: {
          ...process.env,
          NEO4J_PASSWORD: process.env.NEO4J_PASSWORD || 'ecommerce123',
        } as Record<string, string>,
      },
})
