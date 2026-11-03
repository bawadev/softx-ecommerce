import { test, expect, Page } from '@playwright/test'
import { execSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

/**
 * QA BATCH 1 — buyer/guest flows, Factory Bay storefront.
 *
 * Ground truth used for selectors (verified against component source):
 * - PDP variant pickers: h3 "Select Size"/"Select Color" + adjacent div
 *   buttons (see ProductDetailClient.tsx; same pattern as the passing
 *   e2e/cart.spec.ts). CTA stays disabled until both are picked.
 * - Seeded variants (scripts/seed-smoke-products.cypher):
 *   smoke-var-001-M (M/White/30) and smoke-var-001-L (L/White/20) on
 *   product smoke-prod-001 ("Classic Cotton T-Shirt", SMOKE-UST-001).
 * - Nav cart badge: span.animate-pulse inside the desktop nav cart link
 *   (Navigation.tsx); only rendered when itemCount > 0.
 * - SearchAutocomplete is ONLY mounted inside the HeroSlider search overlay
 *   (placeholder "Search products..."). With 0 HeroSlide nodes the hero — and
 *   therefore ALL site search UI — renders nothing (HeroSlider returns null).
 *   A temporary HeroSlide is seeded for flows 01/04 and deleted afterwards.
 * - Cart quantity buttons are the literal '−' (U+2212) / '+' buttons in
 *   CartItem.tsx; remove is the "Remove" text button.
 * - Profile menu toggle: button[aria-label="Profile menu"]; logout lives in
 *   that dropdown ("Logout"); logout reloads to /{locale}.
 * - /en/profile server guard redirects anonymous users to
 *   /en/login?returnTo=/en/profile (profile/page.tsx).
 */

const REPO_ROOT = fs.existsSync(path.join(process.cwd(), 'docker-compose.yml'))
  ? process.cwd()
  : path.resolve(__dirname, '..')

const SHOTS = path.join(REPO_ROOT, '.superpowers', 'qa', 'shots')
const SEED_FILE = path.join(
  REPO_ROOT,
  'apps/factorybay/scripts/seed-smoke-products.cypher'
)

/** Run a cypher statement against the docker-compose Neo4j (matches smoke.spec.ts usage). */
function runCypher(cypher: string): string {
  const quoted = `'${cypher.replace(/'/g, `'\\''`)}'`
  return execSync(
    `docker compose exec -T neo4j cypher-shell -u neo4j -p ecommerce123 ${quoted}`,
    { cwd: REPO_ROOT, stdio: ['ignore', 'pipe', 'pipe'] }
  ).toString()
}

/** Re-apply the committed SMOKE seed (idempotent: clears SMOKE-* first). */
function restoreSmokeSeed(): void {
  execSync(
    `docker compose exec -T neo4j bash -c 'cypher-shell -u neo4j -p ecommerce123' < "${SEED_FILE}"`,
    { cwd: REPO_ROOT, stdio: ['ignore', 'pipe', 'pipe'] }
  )
}

const HERO_ID = 'qa-batch1-temp-hero'

function seedTempHeroSlide(): void {
  runCypher(`MATCH (h:HeroSlide {id: "${HERO_ID}"}) DETACH DELETE h`)
  runCypher(`
    CREATE (h:HeroSlide {
      id: "${HERO_ID}",
      imageUrl: "https://picsum.photos/1600/900",
      animationType: "left-panel",
      badgeText: "QA Batch 1",
      title: "QA Hero",
      subtitle: "Temporary slide for QA batch 1",
      linkUrl: "/en/shop",
      displayOrder: 1,
      isActive: true,
      createdAt: toString(datetime()),
      updatedAt: toString(datetime())
    })
  `)
}

function deleteTempHeroSlide(): void {
  runCypher(`MATCH (h:HeroSlide {id: "${HERO_ID}"}) DETACH DELETE h`)
}

const browserName = () => test.info().project.name

async function shot(page: Page, name: string) {
  fs.mkdirSync(SHOTS, { recursive: true })
  await page.screenshot({
    path: path.join(SHOTS, `${name}-${browserName()}.png`),
    fullPage: true,
  })
}

/** Desktop nav cart badge (span.animate-pulse — mobile badge lacks the class). */
const navBadge = (page: Page) =>
  page.locator('nav a[href*="/cart"] span.animate-pulse').first()

/** Add one Classic Cotton T-Shirt (M / White) as the current (guest) user. */
async function addClassicTShirt(page: Page): Promise<void> {
  await page.goto('/en/product/smoke-prod-001')
  // Chain from the adjacent DIV (not from the buttons themselves — chaining
  // getByRole under a button-matching locator would look for nested buttons).
  const sizeRow = page.locator('h3:has-text("Select Size") + div')
  await sizeRow.getByRole('button', { name: 'M', exact: true }).click()
  const colorRow = page.locator('h3:has-text("Select Color") + div')
  await colorRow.getByRole('button', { name: 'White', exact: true }).click()
  const addToCart = page.getByRole('button', { name: 'Add to Cart' })
  await expect(addToCart).toBeEnabled()
  await addToCart.click()
  await expect(page.getByText('Added to cart!')).toBeVisible()
}

/**
 * Submit the login form, guarding against the pre-hydration native-submit
 * race (observed in webkit dev): clicking "Sign In" before React attaches
 * onSubmit makes the browser native-submit the actionless form — a full GET
 * reload that silently clears the fields and does nothing. Detected via
 * neither-navigation-nor-error within the probe window → re-fill and retry.
 */
async function submitLogin(
  page: Page,
  email: string,
  password: string
): Promise<'navigated' | 'error'> {
  for (let attempt = 0; attempt < 3; attempt++) {
    await page.getByLabel('Email').fill(email)
    await page.getByLabel('Password', { exact: true }).fill(password)
    await page.getByRole('button', { name: 'Sign In' }).click()
    const outcome = await Promise.race([
      page.waitForURL('**/en/shop', { timeout: 8000 }).then(() => 'navigated' as const),
      page.locator('div.bg-red-50').first().waitFor({ timeout: 8000 }).then(() => 'error' as const),
      page.waitForTimeout(2500).then(() => 'settled' as const),
    ])
    if (outcome === 'navigated' || outcome === 'error') return outcome
    // 'settled' → assume the native-reload race; loop re-fills and re-clicks.
  }
  throw new Error('Login submit was never handled by React (hydration race)')
}

/** Login via /en/login (full-page reload to /en/shop on success). */
async function login(page: Page, email: string, password: string): Promise<void> {
  await page.goto('/en/login')
  await page.waitForLoadState('networkidle').catch(() => {})
  await page.waitForTimeout(300)
  const outcome = await submitLogin(page, email, password)
  expect(outcome).toBe('navigated')
}

test.beforeAll(() => {
  seedTempHeroSlide()
})

test.afterAll(() => {
  deleteTempHeroSlide()
  // Safety sweep: guarantee the seeded customer's cart is empty for the next
  // QA batches even if a run aborts between an add and its remove.
  runCypher(
    'MATCH (u:User {email: "test@example.com"})-[r:HAS_CART_ITEM]->(c:CartItem) DETACH DELETE c'
  )
})

// ---------------------------------------------------------------- FLOW 01
test('FLOW 01 — home renders hero section + new arrivals with SMOKE product', async ({
  page,
}) => {
  await page.goto('/en')

  // Hero section container (HeroSlider root div). Slide CONTENT is not
  // asserted (slide is a QA temp), only that the section renders.
  const hero = page.locator('div.relative.overflow-hidden.bg-black-900')
  await expect(hero).toBeVisible()

  // New arrivals section heading + seeded SMOKE product card.
  await expect(page.getByRole('heading', { name: 'New Arrivals' })).toBeVisible()
  await expect(
    page.getByRole('link', { name: /classic cotton/i }).first()
  ).toBeVisible()
})

// ---------------------------------------------------------------- FLOW 02
test('FLOW 02 — /en/shop lists products and card links open the PDP', async ({
  page,
}) => {
  await page.goto('/en/shop')
  await expect(
    page.getByRole('heading', { name: 'Shop All Products' })
  ).toBeVisible()
  await expect(page.getByText(/^\d+ products$/)).toBeVisible()

  const card = page.getByRole('link', { name: /classic cotton/i }).first()
  await expect(card).toBeVisible()
  await card.click()
  await page.waitForURL('**/product/**')
  await expect(
    page.getByRole('heading', { name: 'Classic Cotton T-Shirt' })
  ).toBeVisible()
})

// ---------------------------------------------------------------- FLOW 03
test('FLOW 03 — category nav tree renders; clicking a category navigates', async ({
  page,
}) => {
  await page.goto('/en')

  // The category section itself (static heading in HomePageClient).
  const section = page.locator('h3:has-text("Shop by Category")')
  await expect(section).toBeVisible()

  // Root category chips are loaded dynamically from Category nodes.
  const chips = page.locator(
    'section:has(h3:text("Shop by Category")) div.flex.flex-wrap > button'
  )
  const chipCount = await chips.count()

  test.info().annotations.push({
    type: 'note',
    description: `Category chips rendered: ${chipCount}`,
  })

  if (chipCount === 0) {
    // Verified in Neo4j: MATCH (c:Category) RETURN count(c) == 0 — the dev DB
    // has no Category nodes seeded, so there is no tree to click.
    test.skip(true, 'No Category nodes seeded in dev Neo4j — category tree is empty (section heading renders, nothing clickable)')
  }

  await chips.first().click()
  // Root chip click expands children / filters on the home page; "View All →"
  // is the link that navigates to /en/shop?category=<id>.
  const viewAll = page.getByRole('link', { name: 'View All →' }).first()
  await viewAll.click()
  await page.waitForURL(/\/en\/shop\?category=/)
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
})

// ---------------------------------------------------------------- FLOW 04
test('FLOW 04 — search: suggestions for "Cotton", submit navigates to results', async ({
  page,
}) => {
  await page.goto('/en')

  // Search is only reachable through the hero slide CTA (SearchAutocomplete
  // is mounted solely inside the HeroSlider overlay).
  await page.getByRole('button', { name: 'Search products...' }).click()
  const searchInput = page.getByPlaceholder('Search products...')
  await expect(searchInput).toBeVisible()

  // Debounced autocomplete (300ms) — suggestions drop down with product name.
  await searchInput.fill('Cotton')
  await expect(page.locator('h4:has-text("Classic Cotton T-Shirt")')).toBeVisible()

  // Submit → /en/shop?search=Cotton with results rendered.
  await searchInput.press('Enter')
  await page.waitForURL(/\/en\/shop\?search=Cotton/)
  // LKD-6: the results header now carries the query, not the generic title.
  await expect(
    page.getByRole('heading', { name: 'Cotton', exact: true })
  ).toBeVisible()
  await expect(
    page.getByRole('link', { name: /classic cotton/i }).first()
  ).toBeVisible()

  // ---- LKD-6 FIXED (was BUG 1): the shop page filters on ?search= ----
  // "Cotton" matches exactly one seeded product (Classic Cotton T-Shirt —
  // no other seeded name/brand contains it).
  await expect(page.getByRole('heading', { name: 'Cotton', exact: true })).toBeVisible()
  await expect(page.getByText('1 products')).toBeVisible()

  // A gibberish query yields the no-results state, not the full catalog.
  await page.goto('/en')
  await page.getByRole('button', { name: 'Search products...' }).click()
  const input2 = page.getByPlaceholder('Search products...')
  await input2.fill('zzzqqq-no-such-product')
  await expect(
    page.getByText('No products found for "zzzqqq-no-such-product"')
  ).toBeVisible()
  await input2.press('Enter')
  await page.waitForURL(/\/en\/shop\?search=zzzqqq-no-such-product/)
  await expect(page.getByText('0 products')).toBeVisible()
  await shot(page, 'flow04-search-filtered')
})

// ---------------------------------------------------------------- FLOW 04b
test('FLOW 04b — LKD-8: search stays reachable with zero hero slides', async ({
  page,
}) => {
  // Wipe ALL hero slides (the suite's temp slide included) — the exact
  // condition under which the storefront used to render no <input> at all.
  runCypher(`MATCH (h:HeroSlide) DETACH DELETE h`)

  await page.goto('/en')

  // The fallback strip renders the search trigger (and no hero slider).
  const trigger = page.getByRole('button', { name: 'Search products...' })
  await expect(trigger).toBeVisible()
  await expect(page.locator('input')).toHaveCount(0) // no input until opened — but search IS reachable

  // The trigger opens the same full-screen search overlay.
  await trigger.click()
  const searchInput = page.getByPlaceholder('Search products...')
  await expect(searchInput).toBeVisible()
  await searchInput.fill('Cotton')
  await expect(page.locator('h4:has-text("Classic Cotton T-Shirt")')).toBeVisible()
  await searchInput.press('Enter')
  await page.waitForURL(/\/en\/shop\?search=Cotton/)
  await expect(page.getByText('1 products')).toBeVisible()
  await shot(page, 'flow04b-search-without-hero')

  // Restore the suite's temp slide (later flows / reruns expect it).
  seedTempHeroSlide()
})

// ---------------------------------------------------------------- FLOW 05
test('FLOW 05 — PDP: gallery section, Rs price, variant buttons, details', async ({
  page,
}) => {
  await page.goto('/en/product/smoke-prod-001')

  // Image gallery section (aspect-[3/4] container; seeded images: [] →
  // renders the "No Image" placeholder, not a broken layout).
  const gallery = page.locator('div.aspect-\\[3\\/4\\]')
  await expect(gallery).toBeVisible()
  await expect(gallery.getByText('No Image')).toBeVisible()

  // Price block shows "Rs <amount>" (stock + struck-through retail).
  await expect(page.getByText(/^Rs 850\.00$/)).toBeVisible()
  await expect(page.getByText(/^Rs 1,?500\.00$/)).toBeVisible()

  // Breadcrumb + identity.
  await expect(page.getByRole('heading', { name: 'Classic Cotton T-Shirt' })).toBeVisible()
  await expect(page.getByText('UrbanStyle').first()).toBeVisible()

  // Variant buttons: sizes M/L under "Select Size", color White under
  // "Select Color" (adjacent-div pattern from e2e/cart.spec.ts).
  const sizeRow = page.locator('h3:has-text("Select Size") + div')
  await expect(sizeRow.getByRole('button', { name: 'M', exact: true })).toBeEnabled()
  await expect(sizeRow.getByRole('button', { name: 'L', exact: true })).toBeEnabled()
  const colorRow = page.locator('h3:has-text("Select Color") + div')
  await expect(colorRow.getByRole('button', { name: /white/i })).toBeEnabled()

  // Stock status block renders for the un-selected state (In Stock).
  await expect(page.getByText('In Stock')).toBeVisible()

  // SKU row.
  await expect(page.getByText('SMOKE-UST-001')).toBeVisible()

  // Similar/recommendations: ProductDetailClient renders NO such section —
  // record its absence (assert the negative so a regression is noticed).
  await expect(
    page.getByRole('heading', { name: /similar|recommended for you|you may also like/i })
  ).toHaveCount(0)
})

// ---------------------------------------------------------------- FLOW 06
test('FLOW 06 — out-of-stock / "Only N left" variant handling', async ({
  page,
}) => {
  // PDP shows "Only {count} left in stock" when the selected variant's stock
  // is between 1 and 9 (ProductDetailClient.tsx). Query the live seed to see
  // whether any SMOKE-UST-001 variant is in that band (or OOS at 0).
  const out = runCypher(
    'MATCH (v:ProductVariant)-[:VARIANT_OF]->(:Product {sku: "SMOKE-UST-001"}) RETURN v.id AS id, v.size AS size, v.stockQuantity AS qty ORDER BY v.id'
  )
  test.info().annotations.push({ type: 'note', description: `Variant stock rows:\n${out}` })

  // cypher-shell CSV row shape: "smoke-var-001-M", "M", 30
  const stocks = [
    ...out.matchAll(/"smoke-var-001-([ML])", "[ML]", (\d+)/g),
  ].map((m) => ({ size: m[1], qty: parseInt(m[2], 10) }))
  const lowStock = stocks.find((s) => s.qty < 10)

  if (!lowStock) {
    test.skip(
      true,
      `No low-stock/OOS variant seeded (${stocks.map((s) => `${s.size}=${s.qty}`).join(', ')} — all in stock): the "Only N left"/OOS paths are not reachable without mutating seed data`
    )
    return
  }

  await page.goto('/en/product/smoke-prod-001')
  const sizeRow = page.locator('h3:has-text("Select Size") + div')
  if (lowStock!.qty === 0) {
    await expect(
      sizeRow.getByRole('button', { name: lowStock.size, exact: true })
    ).toBeDisabled()
    await expect(page.getByText('Out of Stock')).toBeVisible()
  } else {
    await sizeRow.getByRole('button', { name: lowStock.size, exact: true }).click()
    const colorRow = page.locator('h3:has-text("Select Color") + div')
    await colorRow.getByRole('button', { name: /white/i }).click()
    await expect(
      page.getByText(`Only ${lowStock!.qty} left in stock`)
    ).toBeVisible()
  }
})

// ---------------------------------------------------------------- FLOW 07
test('FLOW 07 — guest add-to-cart: M+White → toast → nav badge shows 1', async ({
  page,
}) => {
  await addClassicTShirt(page)
  await expect(page.getByText('Added to cart!')).toBeVisible()
  await expect(navBadge(page)).toBeVisible()
  await expect(navBadge(page)).toHaveText('1')
})

// ---------------------------------------------------------------- FLOW 08
test('FLOW 08 — cart page: quantity +/- , remove item, empty state', async ({
  page,
}) => {
  await addClassicTShirt(page)
  await page.goto('/en/cart')

  await expect(page.getByRole('heading', { name: 'Shopping Cart' })).toBeVisible()
  await expect(page.getByText('1 item in your cart')).toBeVisible()
  await expect(page.getByText('Size: M').first()).toBeVisible()

  // Increase: '+' button (CartItem.tsx) → optimistic qty 2.
  await page.getByRole('button', { name: '+', exact: true }).click()
  await expect(page.getByText('2 items in your cart')).toBeVisible()
  await expect(page.locator('span.w-12', { hasText: '2' })).toBeVisible()

  // Decrease back to 1 (the '−' U+2212 button).
  await page.getByRole('button', { name: '\u2212', exact: true }).click()
  await expect(page.getByText('1 item in your cart')).toBeVisible()

  // LKD-7 FIXED (was BUG 2): removing the last item lands on the proper
  // empty state IMMEDIATELY — "Your cart is empty" + Start Shopping — with
  // no stale order summary or live checkout CTA, and no reload needed.
  await page.getByRole('button', { name: 'Remove' }).click()
  await expect(page.getByText('Your cart is empty')).toBeVisible()
  await expect(
    page.getByRole('link', { name: 'Start Shopping' })
  ).toBeVisible()
  await expect(page.getByText('Proceed to Checkout')).toHaveCount(0)
  await expect(page.getByText('Order Summary')).toHaveCount(0)
  await expect(navBadge(page)).toHaveCount(0)
  await shot(page, 'flow08-empty-state-instant')
})

// ---------------------------------------------------------------- FLOW 09
test('FLOW 09 — cart persists across a full page reload', async ({ page }) => {
  await addClassicTShirt(page)
  await expect(navBadge(page)).toHaveText('1')

  await page.reload()
  await expect(navBadge(page)).toHaveText('1')

  await page.goto('/en/cart')
  await expect(page.getByText('1 item in your cart')).toBeVisible()
  await expect(
    page.getByRole('link', { name: /classic cotton/i }).first()
  ).toBeVisible()
})

// ------------------------------------------------- FLOW 10 (+11 folded in)
test('FLOW 10 — cart self-heal: variant deleted server-side disappears from cart', async ({
  page,
}) => {
  test.setTimeout(90_000)
  await addClassicTShirt(page) // adds smoke-var-001-M (M/White)
  await page.goto('/en/cart')
  await expect(page.getByText('1 item in your cart')).toBeVisible()
  await expect(page.getByText('Size: M').first()).toBeVisible()

  // Delete the variant the cart line points at (real id from the seed
  // cypher is smoke-var-001-M, NOT smoke-ust-001-m).
  runCypher('MATCH (v:ProductVariant {id: "smoke-var-001-M"}) DETACH DELETE v')

  try {
    await page.reload()

    // No crash: the cart page still renders (not the failure branch).
    await expect(
      page.getByRole('heading', { name: 'Shopping Cart' })
    ).toBeVisible()
    await expect(page.getByText('Failed to load cart')).toHaveCount(0)

    // Self-heal (engine cart.ts drops vanished variants): line gone.
    await expect(page.getByText('Your cart is empty')).toBeVisible()
    await expect(page.getByText('Size: M')).toHaveCount(0)
    await expect(navBadge(page)).toHaveCount(0) // badge 0 → not rendered
    await shot(page, 'flow10-self-heal-after-variant-delete')
  } finally {
    restoreSmokeSeed()
  }

  // Post-restore sanity: the variant is back and purchasable again.
  await page.goto('/en/product/smoke-prod-001')
  const sizeRow = page.locator('h3:has-text("Select Size") + div')
  await expect(sizeRow.getByRole('button', { name: 'M', exact: true })).toBeEnabled()
})

// ---------------------------------------------------------------- FLOW 12
test('FLOW 12 — signup validation: bad email, weak password, duplicate account', async ({
  page,
}) => {
  // (a) Malformed email — input type=email native validation blocks submit.
  await page.goto('/en/signup')
  await page.waitForLoadState('networkidle').catch(() => {})
  await page.waitForTimeout(300)
  await page.getByLabel('First Name').fill('Qa')
  await page.getByLabel('Last Name').fill('Batch')
  await page.getByLabel('Email').fill('not-an-email')
  await page.getByLabel('Password', { exact: true }).fill('Valid123!')
  await page.getByRole('button', { name: 'Create Account' }).click()
  await expect(page.locator('input#email:invalid')).toHaveCount(1)
  await expect(page).toHaveURL(/\/en\/signup$/)
  await shot(page, 'flow12-invalid-email')

  // (b) Weak password — engine parity string, rendered in the red error div.
  await page.goto('/en/signup')
  await page.waitForLoadState('networkidle').catch(() => {})
  await page.waitForTimeout(300)
  await page.getByLabel('First Name').fill('Qa')
  await page.getByLabel('Last Name').fill('Batch')
  await page.getByLabel('Email').fill(`qa-batch1+${Date.now()}@example.com`)
  await page.getByLabel('Password', { exact: true }).fill('Short1!')
  await page.getByRole('button', { name: 'Create Account' }).click()
  await expect(
    page.getByText('Password must be at least 8 characters long')
  ).toBeVisible()
  await shot(page, 'flow12-weak-password')

  // (c) Duplicate email — CONFLICT from the engine.
  await page.goto('/en/signup')
  await page.waitForLoadState('networkidle').catch(() => {})
  await page.waitForTimeout(300)
  await page.getByLabel('First Name').fill('Qa')
  await page.getByLabel('Last Name').fill('Batch')
  await page.getByLabel('Email').fill('test@example.com')
  await page.getByLabel('Password', { exact: true }).fill('Customer123!')
  await page.getByRole('button', { name: 'Create Account' }).click()
  await expect(
    page.getByText('An account with this email already exists')
  ).toBeVisible()
  await shot(page, 'flow12-duplicate-email')
})

// ---------------------------------------------------------------- FLOW 13
test('FLOW 13 — login: wrong password rejected; correct login shows Profile menu', async ({
  page,
}) => {
  await page.goto('/en/login')
  await page.waitForLoadState('networkidle').catch(() => {})
  await page.waitForTimeout(300)

  const wrong = await submitLogin(page, 'test@example.com', 'WrongPass1!')
  expect(wrong).toBe('error')
  await expect(page.getByText('Invalid email or password')).toBeVisible()
  await shot(page, 'flow13-wrong-password')

  // Correct credentials → full reload to /en/shop + profile menu in nav.
  const right = await submitLogin(page, 'test@example.com', 'Customer123!')
  expect(right).toBe('navigated')
  await expect(page.locator('button[aria-label="Profile menu"]')).toBeVisible()
  await expect(
    page.getByRole('link', { name: 'Sign in / Sign up' })
  ).toBeHidden()
})

// ---------------------------------------------------------------- FLOW 14
test('FLOW 14 — guest cart migrates to the logged-in account', async ({ page }) => {
  // Fresh guest context: one item in the (cookie-based) guest cart.
  await addClassicTShirt(page)
  await expect(navBadge(page)).toHaveText('1')

  // Login as the seeded customer → engine merges guest lines into user cart.
  await login(page, 'test@example.com', 'Customer123!')
  await expect(navBadge(page)).toHaveText('1')

  await page.goto('/en/cart')
  await expect(page.getByText('1 item in your cart')).toBeVisible()
  await expect(
    page.getByRole('link', { name: /classic cotton/i }).first()
  ).toBeVisible()
  await shot(page, 'flow14-migrated-cart')

  // Cleanup: leave the seeded customer's cart empty for the other batches.
  // The optimistic UI flips to "0 items" BEFORE the remove action's round
  // trip completes — ending the test at that point can cancel the mutation
  // and strand a CartItem in Neo4j (observed once). Poll the DB so the
  // server-side removal is confirmed before the context closes.
  await page.getByRole('button', { name: 'Remove' }).click()
  await expect(
    page.getByText('0 items in your cart').or(page.getByText('Your cart is empty'))
  ).toBeVisible()
  for (let i = 0; i < 20; i++) {
    const out = runCypher(
      'MATCH (u:User {email: "test@example.com"})-[:HAS_CART_ITEM]->(c:CartItem) RETURN count(c) AS n'
    )
    const n = parseInt(out.match(/(\d+)\s*$/)?.[1] ?? '99', 10)
    if (n === 0) break
    await page.waitForTimeout(250)
  }
  await page.reload()
  await expect(page.getByText('Your cart is empty')).toBeVisible()
})

// ---------------------------------------------------------------- FLOW 15
test('FLOW 15 — logout: nav shows Sign in; /en/profile redirects to login', async ({
  page,
}) => {
  await login(page, 'test@example.com', 'Customer123!')
  await expect(page.locator('button[aria-label="Profile menu"]')).toBeVisible()

  // Logout lives inside the profile dropdown (Navigation.tsx).
  await page.locator('button[aria-label="Profile menu"]').click()
  await page.getByRole('button', { name: 'Logout' }).click()
  await page.waitForURL(/\/en$/)

  await expect(
    page.getByRole('link', { name: 'Sign in / Sign up' })
  ).toBeVisible()

  // Profile guard: anonymous users are redirected by the server component.
  await page.goto('/en/profile')
  await page.waitForURL(/\/en\/login/)
  // Next serves the returnTo param unencoded (see profile/page.tsx redirect).
  await expect(page).toHaveURL(/returnTo=(\/|%2F)en(\/|%2F)profile/)
  await expect(
    page.getByRole('heading', { name: 'Sign In' })
  ).toBeVisible()
  await shot(page, 'flow15-profile-redirect')
})
