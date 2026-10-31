import { test, expect } from '@playwright/test'

/**
 * Storefront smoke tests.
 *
 * Requires seeded infra: Neo4j up (`docker compose up -d neo4j`) and at least
 * one product whose name matches /shirt|tee|hoodie/i with variants in stock
 * (product detail renders "Rs <amount>" prices).
 *
 * Seeding note: `npm run db:seed` creates users + hero slides only (and needs
 * MinIO for hero images); the product seed scripts
 * (`apps/factorybay/scripts/seed-test-products.ts` et al.) also upload to
 * MinIO. The committed MinIO-free seed data lives in
 * `apps/factorybay/scripts/seed-smoke-products.cypher` (4 products mirroring
 * seed-test-products.ts, all SKUs prefixed 'SMOKE-'). Apply it with:
 *
 *   docker compose exec -T neo4j bash -c \
 *     'cypher-shell -u neo4j -p ecommerce123' \
 *     < apps/factorybay/scripts/seed-smoke-products.cypher
 *
 * The script is idempotent (it clears prior SMOKE-* nodes first). To seed a
 * single product by hand instead, keep the same SKU prefix so the cleanup
 * below still matches, e.g.:
 *
 *   docker compose exec -T neo4j cypher-shell -u neo4j -p ecommerce123 \
 *     "CREATE (p:Product {id: 'smoke-1', name: 'Classic Cotton T-Shirt',
 *       description: 'Premium quality cotton t-shirt, comfortable and durable.',
 *       brand: 'UrbanStyle', gender: 'MEN', stockPrice: 850, retailPrice: 1500,
 *       sku: 'SMOKE-UST-001', category: 'SHIRT', images: [],
 *       createdAt: datetime().toISOString(), updatedAt: datetime().toISOString()})
 *     WITH p
 *     UNWIND [{size:'M',color:'White',qty:30},{size:'L',color:'White',qty:20}] AS v
 *     CREATE (pv:ProductVariant {id: 'smoke-var-' + v.size, productId: p.id,
 *       size: v.size, color: v.color, stockQuantity: v.qty, images: []})
 *     CREATE (pv)-[:VARIANT_OF]->(p)"
 *
 * Image URLs are remote or empty — assertions are on text, never on images.
 *
 * NOTE: the integration conformance suite (`npm run test:integration`)
 * asserts exact product totals over the whole graph — remove the SMOKE-*
 * products before running it, e.g.:
 *   docker compose exec -T neo4j bash -c 'cypher-shell -u neo4j -p ecommerce123' \
 *     <<< "MATCH (p:Product) WHERE p.sku STARTS WITH 'SMOKE-' OPTIONAL MATCH (v:ProductVariant)-[:VARIANT_OF]->(p) DETACH DELETE p, v;"
 */

test('shop lists seeded products', async ({ page }) => {
  await page.goto('/en/shop')
  await expect(page.locator('main, body').first()).toBeVisible()
  await expect(
    page.getByRole('link', { name: /premium|shirt|tee|hoodie/i }).first()
  ).toBeVisible()
})

test('product detail renders a price', async ({ page }) => {
  await page.goto('/en/shop')
  const card = page
    .getByRole('link', { name: /premium|shirt|tee|hoodie/i })
    .first()
  await card.click()
  await expect(page.getByText(/LKR|Rs/i).first()).toBeVisible()
})
