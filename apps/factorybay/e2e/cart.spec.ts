import { test, expect } from '@playwright/test'

/**
 * Golden journey: browse -> PDP -> add to cart -> cart.
 *
 * Uses the SMOKE-* products seeded by scripts/seed-smoke-products.cypher
 * (seeding + cleanup instructions live in smoke.spec.ts's header). Only
 * 'Classic Cotton T-Shirt' (SMOKE-UST-001) is seeded with variants
 * (M/L x White, in stock), so the journey deliberately targets it by name.
 *
 * PDP reality (see ProductDetailClient.tsx): there is NO default variant —
 * selectedSize/selectedColor start null, and the CTA stays disabled with the
 * label "Select Size & Color" until both are picked, after which it reads
 * "Add to Cart". Post-add feedback is an "Added to cart!" message. The picks
 * below click the first in-stock size and then the first color still
 * available for that size (the PDP disables unavailable combinations).
 *
 * Cart is served by the engine's CartService (guest cookie normalized by the
 * engine), so the added item must survive a full page load of /en/cart.
 */

test('guest can add a product to the cart', async ({ page }) => {
  await page.goto('/en/shop')
  await page.getByRole('link', { name: /classic cotton/i }).first().click()
  await page.waitForURL('**/product/**')

  // Variant selection is mandatory: first enabled size, then the first
  // color enabled for that size (each pick list sits right under its
  // "Select Size" / "Select Color" section heading).
  const sizeChoices = page.locator(
    'h3:has-text("Select Size") + div button:not([disabled])'
  )
  await sizeChoices.first().click()

  const colorChoices = page.locator(
    'h3:has-text("Select Color") + div button:not([disabled])'
  )
  await colorChoices.first().click()

  const addToCart = page.getByRole('button', { name: 'Add to Cart' })
  await expect(addToCart).toBeEnabled()
  await addToCart.click()
  await expect(page.getByText('Added to cart!')).toBeVisible()

  // Final assertions on the engine-served cart page: item, count, price.
  await page.goto('/en/cart')
  await expect(page.getByText('1 item in your cart')).toBeVisible()
  await expect(
    page.getByRole('link', { name: /classic cotton/i }).first()
  ).toBeVisible()
  await expect(page.getByText(/Rs/i).first()).toBeVisible()
})
