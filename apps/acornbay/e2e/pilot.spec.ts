import { test, expect } from '@playwright/test'

/**
 * Pilot verification specs (Phase 6 Task 3) — prove the second client is
 * live-green against ITS OWN tenant through the shared `@softx/engine` +
 * `@softx/contract` packages.
 *
 * Fixture: `scripts/seed-client.cypher` (idempotent) — 3 products with
 * deliberately client-distinct names:
 *   Acorn Hoodie  id=acornbay-product-hoodie  59.00 stock / 72.00 retail (LKR)
 *   Acorn Cap     id=acornbay-product-cap
 *   Acorn Tote    id=acornbay-product-tote
 * Cross-tenant isolation (acornbay's catalog vs factorybay's) is proven
 * separately by `npm run verify:tenants` at the repo root.
 */

test('shop lists this tenant\'s seeded Acorn products', async ({ page }) => {
  await page.goto('/shop')

  // All three seeded products, by name, as catalog links.
  for (const name of ['Acorn Hoodie', 'Acorn Cap', 'Acorn Tote']) {
    await expect(page.getByRole('link', { name: new RegExp(name, 'i') })).toBeVisible()
  }

  // The catalog total reflects exactly this tenant's seed.
  await expect(page.getByText('3 products in this store')).toBeVisible()
})

test('product detail renders the seeded product with an Rs (LKR) price', async ({ page }) => {
  await page.goto('/product/acornbay-product-hoodie')

  await expect(page.getByRole('heading', { name: 'Acorn Hoodie' })).toBeVisible()
  await expect(page.getByText('Acorn Bay').first()).toBeVisible()

  // Money is a v1 DTO in minor units; the PDP renders "LKR 59.00" (the
  // hoodie is on sale — the 72.00 retail strikes through next to it).
  await expect(page.locator('.pdp-price')).toHaveText('LKR 59.00')
  await expect(page.locator('.pdp-price-was')).toHaveText('LKR 72.00')
})
