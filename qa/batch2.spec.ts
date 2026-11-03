import { test, expect, Page } from '@playwright/test'
import { execSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

/**
 * QA BATCH 2 — checkout / orders / profile flows, Factory Bay storefront.
 *
 * Ground truth used for selectors (verified against component source):
 * - Guest checkout (checkout/page.tsx + CheckoutPageClient.tsx): the checkout
 *   page LOADS for guests (cookie cart); guard is at SUBMIT — handleSubmit
 *   short-circuits !isAuthenticated into a "Sign In Required" modal
 *   (h3 "Sign In Required" + Sign In / Create Account links). Guest notice
 *   block anchors on the "Create Account →" link (i18n keys
 *   guestCheckoutNotice/guestCheckoutBenefits are MISSING from en.json —
 *   evidence captured, see report BUG list).
 * - Shipping rule (CheckoutPageClient.tsx:55, engine order.ts parity):
 *   SHIP: totalAmount >= 100 → 0 (rendered "FREE"), else 9.99;
 *   COLLECT: always 0. DB prices are MAJOR units (fromMajorAmount) — tee is
 *   Rs 850 (free branch), QA product stockPrice 59.99 (paid branch:
 *   59.99 + 9.99 = 69.98).
 * - Delivery radios: input[name=deliveryMethod][value=SHIP|COLLECT]; the
 *   address section is hidden unless SHIP.
 * - Form labels (en.json checkout.*): "Full Name", "Email" (disabled when
 *   logged in, prefilled), "Phone Number", "Address Line 1", "City", "State",
 *   "Postal Code", "Country" (prefilled "United States"); submit button
 *   "Place Order".
 * - Orders are created PENDING with orderNumber "FB-<ms>" (order.repository);
 *   confirmation page h1 "Order Confirmed!".
 * - Payment page (payment/page.tsx) only renders for CONFIRMED orders —
 *   PENDING redirects to /order/{id} (asserted); the test flips the fresh
 *   order to CONFIRMED via cypher to reach the upload UI.
 *   Upload (PaymentPageClient): input[type=file], button "Upload Payment
 *   Proof", success panel "Payment Proof Uploaded!". MinIO is DOWN →
 *   lib/minio uploadFile throws (ECONNREFUSED) → server action catches →
 *   error Notification (div[role=alert] h3 "Failed to upload payment
 *   proof"). App not crashing is the pass condition.
 * - Severed variant: engine order.mapper returns productName '(unavailable)'
 *   and productId '' when the product is deleted post-purchase; both
 *   OrdersPageClient and OrderConfirmationClient render it as a SPAN (never
 *   a link) in that case.
 * - Profile (ProfileClient): tabs "Shopping Preferences" / "Measurements";
 *   brand input + "Add" button + chips; "Save Preferences" → "Preferences
 *   saved successfully!"; chest field under "Chest (cm)"; "Save
 *   Measurements" → "Measurements saved successfully!". NO recently-viewed
 *   section exists on the profile page — recently-viewed renders on the HOME
 *   page for authenticated users (HomePageClient section h2 "Recently
 *   Viewed"), fed by trackProductViewAction fired from ProductDetailClient's
 *   mount useEffect.
 */

const REPO_ROOT = fs.existsSync(path.join(process.cwd(), 'docker-compose.yml'))
  ? process.cwd()
  : path.resolve(__dirname, '..')

const SHOTS = path.join(REPO_ROOT, '.superpowers', 'qa', 'shots')
const TEST_EMAIL = 'test@example.com'
const TEST_PASSWORD = 'Customer123!'

const QA_LOW = {
  productId: 'qa-lowprice-1',
  variantId: 'qa-lowprice-var-1',
  name: 'QA Lowprice Tee',
  price: 59.99,
}
const QA_SEVERED = {
  productId: 'qa-severed-1',
  variantId: 'qa-severed-var-1',
  name: 'QA Severed Product',
}

/** Order placed by FLOW 19, consumed by FLOW 20 (same worker, workers=1). */
let placedOrder: { id: string; orderNumber: string } | null = null
/** ProductView ids that existed before this worker ran (cleanup delta). */
let preexistingViewIds: Set<string> = new Set()

/** Run a cypher statement against the docker-compose Neo4j. */
function runCypher(cypher: string): string {
  const quoted = `'${cypher.replace(/'/g, `'\\''`)}'`
  return execSync(
    `docker compose exec -T neo4j cypher-shell -u neo4j -p ecommerce123 ${quoted}`,
    { cwd: REPO_ROOT, stdio: ['ignore', 'pipe', 'pipe'] }
  ).toString()
}

function createQaProduct(
  id: string,
  name: string,
  sku: string,
  price: number,
  variantId: string,
  size: string,
  color: string
): void {
  runCypher(`MATCH (p:Product {id: "${id}"}) OPTIONAL MATCH (v:ProductVariant)-[:VARIANT_OF]->(p) DETACH DELETE p, v`)
  runCypher(`
    CREATE (p:Product {id: "${id}", name: "${name}", description: 'QA batch 2 temporary product', brand: 'QABrand', gender: 'UNISEX', stockPrice: ${price}, retailPrice: ${price + 10}, sku: "${sku}", category: 'SHIRT', images: [], createdAt: toString(datetime()), updatedAt: toString(datetime())})
    WITH p
    CREATE (:ProductVariant {id: "${variantId}", productId: "${id}", size: "${size}", color: "${color}", stockQuantity: 25, images: []})-[:VARIANT_OF]->(p)
  `)
}

function deleteQaProduct(id: string): void {
  runCypher(`MATCH (p:Product {id: "${id}"}) OPTIONAL MATCH (v:ProductVariant)-[:VARIANT_OF]->(p) DETACH DELETE p, v`)
}

/** Empty the seeded customer's DB cart (test setup between scenarios). */
function clearDbCart(): void {
  runCypher(
    `MATCH (u:User {email: "${TEST_EMAIL}"})-[r:HAS_CART_ITEM]->(c:CartItem) DETACH DELETE c`
  )
}

const browserName = () => test.info().project.name

async function shot(page: Page, name: string) {
  fs.mkdirSync(SHOTS, { recursive: true })
  await page.screenshot({
    path: path.join(SHOTS, `${name}-${browserName()}.png`),
    fullPage: true,
  })
}

const navBadge = (page: Page) =>
  page.locator('nav a[href*="/cart"] span.animate-pulse').first()

/** Add a variant to the cart from the PDP (size + color pickers). */
async function addVariant(
  page: Page,
  productId: string,
  size: string,
  color: string
): Promise<void> {
  await page.goto(`/en/product/${productId}`)
  const sizeRow = page.locator('h3:has-text("Select Size") + div')
  await sizeRow.getByRole('button', { name: size, exact: true }).click()
  const colorRow = page.locator('h3:has-text("Select Color") + div')
  await colorRow.getByRole('button', { name: color, exact: true }).click()
  const addToCart = page.getByRole('button', { name: 'Add to Cart' })
  await expect(addToCart).toBeEnabled()
  await addToCart.click()
  await expect(page.getByText('Added to cart!')).toBeVisible()
}

/** Login helper (hydration-race guarded, mirrors batch 1). */
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
  }
  throw new Error('Login submit was never handled by React (hydration race)')
}

async function login(page: Page): Promise<void> {
  await page.goto('/en/login')
  await page.waitForLoadState('networkidle').catch(() => {})
  await page.waitForTimeout(300)
  const outcome = await submitLogin(page, TEST_EMAIL, TEST_PASSWORD)
  expect(outcome).toBe('navigated')
}

/**
 * Fill the SHIP checkout form and click Place Order, hardened against the
 * webkit hydration double-fire (same class as batch 1's login race): a click
 * landing during hydration can BOTH run the React handler (order created!)
 * and native-submit the actionless form (full GET reload back to an empty
 * checkout). Detection: navigation to /en/order/{id} wins; otherwise, if the
 * reloaded form shows the engine's "Your cart is empty" error, the ghost
 * click already placed the order — recover the id from Neo4j and navigate
 * directly. Returns the confirmed order id.
 */
async function fillCheckoutAndPlace(page: Page): Promise<string> {
  const fill = async () => {
    await page.getByLabel('Full Name').fill('QA Batch Two')
    await page.getByLabel('Phone Number').fill('+94 77 123 4567')
    await page.getByLabel('Address Line 1').fill('123 QA Street')
    await page.getByLabel('City', { exact: true }).fill('Colombo')
    await page.getByLabel('State', { exact: true }).fill('Western')
    await page.getByLabel('Postal Code').fill('10100')
  }

  for (let attempt = 0; attempt < 3; attempt++) {
    await fill()
    // Let hydration settle before submitting (guards the native-submit race).
    await page.waitForLoadState('networkidle').catch(() => {})
    await page.waitForTimeout(400)
    await page.getByRole('button', { name: 'Place Order' }).click()

    const outcome = await Promise.race([
      page
        .waitForURL(/\/en\/order\/[^/]+$/, { timeout: 30_000 })
        .then(() => 'navigated' as const),
      page
        .locator('div.bg-red-50', { hasText: 'cart is empty' })
        .waitFor({ timeout: 30_000 })
        .then(() => 'ghost-placed' as const),
      page.waitForTimeout(32_000).then(() => 'settled' as const),
    ])

    if (outcome === 'navigated') return page.url().split('/').pop() ?? ''

    if (outcome === 'ghost-placed') {
      // The submit fired twice (hydration race): the order EXISTS but the
      // page reloaded instead of navigating. Recover it from the DB.
      const out = runCypher(
        `MATCH (u:User {email: "${TEST_EMAIL}"})-[:PLACED_ORDER]->(o:Order) RETURN o.id AS id ORDER BY o.createdAt DESC LIMIT 1`
      )
      const id = out.match(/"([^"]+)"/)?.[1] ?? ''
      test.info().annotations.push({
        type: 'note',
        description: `Hydration double-fire: order ${id} was placed but the client reloaded to checkout — recovering via DB`,
      })
      await page.goto(`/en/order/${id}`)
      await page
        .getByRole('heading', { name: 'Order Confirmed!' })
        .waitFor({ timeout: 30_000 })
      return id
    }
    // 'settled' → nothing observable happened; loop re-fills and re-clicks.
  }
  throw new Error('Place Order was never handled by React (hydration race)')
}

test.beforeAll(() => {
  // QA low-price product (exercises the +9.99 shipping branch).
  createQaProduct(
    QA_LOW.productId, QA_LOW.name, 'QA-LOW-001', QA_LOW.price,
    QA_LOW.variantId, 'M', 'Black'
  )
  // Snapshot existing ProductView ids so only OUR views are cleaned up.
  const out = runCypher('MATCH (v:ProductView) RETURN v.id AS id')
  preexistingViewIds = new Set(
    [...out.matchAll(/"([^"]+)"/g)].map((m) => m[1]).filter(Boolean)
  )
})

test.afterAll(() => {
  // Each step guarded: one failing cypher must not skip the remaining
  // cleanup (observed during development — a transient docker exec failure
  // aborted the whole sweep).
  const step = (label: string, fn: () => void) => {
    try {
      fn()
    } catch (e) {
      console.error(`afterAll step "${label}" failed:`, e)
    }
  }
  // QA products gone (flow 21 already deleted its own; idempotent anyway).
  step('delete qa-lowprice', () => deleteQaProduct(QA_LOW.productId))
  step('delete qa-severed', () => deleteQaProduct(QA_SEVERED.productId))
  // Profile edits: no UserPreference/UserMeasurements existed pre-run
  // (verified via cypher before the suite) — drop whatever we created.
  step('delete UserPreference', () =>
    runCypher(
      `MATCH (n:UserPreference {userId: "755400dc-caff-40b2-866f-acec7c9a3bee"}) DETACH DELETE n`
    ))
  step('delete UserMeasurements', () =>
    runCypher(
      `MATCH (n:UserMeasurements {userId: "755400dc-caff-40b2-866f-acec7c9a3bee"}) DETACH DELETE n`
    ))
  // Delete only the ProductView nodes created during this worker's run.
  // Guard: if the pre-run snapshot somehow failed to parse (empty set while
  // views pre-existed), skip view cleanup rather than delete too much.
  step('delete new ProductViews', () => {
    const out = runCypher('MATCH (v:ProductView) RETURN v.id AS id')
    const ids = [...out.matchAll(/"([^"]+)"/g)]
      .map((m) => m[1])
      .filter(Boolean)
      .filter((id) => !preexistingViewIds.has(id))
    if (ids.length > 0 || preexistingViewIds.size > 0) {
      for (const id of ids) {
        runCypher(`MATCH (v:ProductView {id: "${id}"}) DETACH DELETE v`)
      }
    }
  })
  // Sweep the customer cart for the next batches.
  step('clear cart', () => clearDbCart())
})

// ---------------------------------------------------------------- FLOW 16
test('FLOW 16 — guest checkout: form loads, submit blocked by login modal', async ({
  page,
}) => {
  test.setTimeout(90_000)
  const consoleErrors: string[] = []
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text())
  })

  // Fresh context = guest. Add the tee (cookie cart) then open checkout.
  await addVariant(page, 'smoke-prod-001', 'M', 'White')
  await page.goto('/en/checkout')

  // The checkout page LOADS for a guest — full form is rendered.
  await expect(page.getByRole('heading', { name: 'Checkout' })).toBeVisible()
  await expect(
    page.getByRole('heading', { name: 'Shipping Information' })
  ).toBeVisible()
  await expect(page.getByLabel('Full Name')).toBeVisible()
  // Guest notice block (anchors on the existing-i18n "Create Account →" link).
  const createAccountLink = page.getByRole('link', { name: /Create Account →/ })
  await expect(createAccountLink).toBeVisible()
  // Guest email field is EDITABLE (only disabled once authenticated).
  await expect(page.getByLabel('Email')).toBeEnabled()

  // Capture what the guest-notice text actually renders (i18n keys
  // guestCheckoutNotice/guestCheckoutBenefits are missing from en.json).
  const noticeText = (await page
    .locator('div.mb-6.p-4.bg-gray-100')
    .first()
    .innerText()) ?? ''
  test.info().annotations.push({
    type: 'note',
    description: `Guest notice block rendered text: ${JSON.stringify(noticeText.trim())}`,
  })
  // LKD-9 FIXED (was BUG 4): the notice renders real copy in BOTH locales'
  // fallback — no raw i18n key paths leak into the UI.
  expect(noticeText).not.toContain('checkout.guestCheckoutNotice')
  expect(noticeText).not.toContain('checkout.guestCheckoutBenefits')
  expect(noticeText).toContain('checking out as a guest')
  await shot(page, 'flow16-guest-checkout')

  // Fill every required field and submit → guard fires at SUBMIT time.
  await page.getByLabel('Full Name').fill('Guest Person')
  await page.getByLabel('Email').fill('guest@example.com')
  await page.getByLabel('Phone Number').fill('+94 77 000 0000')
  await page.getByLabel('Address Line 1').fill('1 Guest Lane')
  await page.getByLabel('City', { exact: true }).fill('Colombo')
  await page.getByLabel('State', { exact: true }).fill('Western')
  await page.getByLabel('Postal Code').fill('10100')
  await page.getByRole('button', { name: 'Place Order' }).click()

  // No order placed: the Sign In Required modal appears, URL unchanged.
  await expect(
    page.getByRole('heading', { name: 'Sign In Required' })
  ).toBeVisible()
  await expect(
    page.getByRole('link', { name: 'Sign In', exact: true }).first()
  ).toBeVisible()
  await expect(page).toHaveURL(/\/en\/checkout$/)
  await shot(page, 'flow16-login-modal')

  const missingKeyErrors = consoleErrors.filter((t) =>
    /guestCheckoutNotice|guestCheckoutBenefits|MISSING_MESSAGE/i.test(t)
  )
  test.info().annotations.push({
    type: 'bug-evidence',
    description: missingKeyErrors.length
      ? `Console reported missing i18n keys (${missingKeyErrors.length} message(s)) for the guest checkout notice`
      : 'No missing-i18n console errors captured',
  })
})

// ---------------------------------------------------------------- FLOW 17
test('FLOW 17 — shipping math: SHIP free >= 100, +9.99 under 100', async ({
  page,
}) => {
  test.setTimeout(90_000)
  await login(page)

  // --- Over 100: Classic Cotton T-Shirt is Rs 850 (seed stockPrice 850,
  // major units) → SHIP is FREE, total == subtotal.
  clearDbCart()
  await addVariant(page, 'smoke-prod-001', 'M', 'White')
  await page.goto('/en/checkout')
  const shipRadio = page.locator('input[name="deliveryMethod"][value="SHIP"]')
  await expect(shipRadio).toBeChecked()

  const summary = page.locator('div.sticky.top-4')
  await expect(summary.getByText(/^Subtotal \(1 items?\)$/)).toBeVisible()
  await expect(summary.getByText(/^Rs 850\.00$/).first()).toBeVisible()
  // Shipping line shows "FREE" and no 9.99 anywhere in the summary.
  await expect(summary.getByText('FREE', { exact: true })).toBeVisible()
  await expect(summary.getByText('Rs 9.99')).toHaveCount(0)
  // Total (span.text-2xl) equals the item subtotal: 850.00.
  expect(((await summary.locator('span.text-2xl').textContent()) ?? '').trim()).toBe(
    'Rs 850.00'
  )
  await shot(page, 'flow17-ship-free-over-100')

  // --- Under 100: QA product Rs 59.99 → +Rs 9.99, total 69.98.
  clearDbCart()
  await addVariant(page, QA_LOW.productId, 'M', 'Black')
  await page.goto('/en/checkout')
  await expect(shipRadio).toBeChecked()
  await expect(summary.getByText(/^Rs 59\.99$/).first()).toBeVisible() // subtotal
  await expect(summary.getByText('Rs 9.99')).toBeVisible() // shipping line
  // Total row: 59.99 + 9.99 = 69.98.
  const totalText = await summary
    .locator('span.text-2xl')
    .textContent()
  expect(totalText?.trim()).toBe('Rs 69.98')
  await shot(page, 'flow17-ship-9-99-under-100')
})

// ---------------------------------------------------------------- FLOW 18
test('FLOW 18 — COLLECT: no shipping charge, total equals items', async ({
  page,
}) => {
  test.setTimeout(90_000)
  await login(page)
  clearDbCart()
  await addVariant(page, QA_LOW.productId, 'M', 'Black')
  await page.goto('/en/checkout')

  // Switch to Collect in Person.
  await page
    .locator('input[name="deliveryMethod"][value="COLLECT"]')
    .check()
  await expect(
    page.locator('input[name="deliveryMethod"][value="COLLECT"]')
  ).toBeChecked()

  // Address section hidden for COLLECT.
  await expect(page.getByLabel('Address Line 1')).toHaveCount(0)
  await expect(
    page.getByRole('heading', { name: 'Shipping Address' })
  ).toHaveCount(0)

  // Order Summary: shipping "FREE" (not 9.99), total == subtotal == 59.99.
  const summary = page.locator('div.sticky.top-4')
  await expect(summary.getByText(/^Rs 59\.99$/).first()).toBeVisible()
  await expect(summary.getByText('FREE', { exact: true })).toBeVisible()
  await expect(summary.getByText('Rs 9.99')).toHaveCount(0)
  expect(((await summary.locator('span.text-2xl').textContent()) ?? '').trim()).toBe(
    'Rs 59.99'
  )
  // COLLECT helper copy renders in the shipping row.
  await expect(summary.getByText('🏪 Ready for pickup within 2-3 business days')).toBeVisible()
  await shot(page, 'flow18-collect')
})

// ---------------------------------------------------------------- FLOW 19
test('FLOW 19 — place order (SHIP): confirmation, FB- number, cart badge 0', async ({
  page,
}) => {
  test.setTimeout(90_000)
  await login(page)
  clearDbCart()
  await addVariant(page, 'smoke-prod-001', 'M', 'White')
  await page.goto('/en/checkout')

  // Logged-in: email disabled + prefilled; country prefilled.
  const emailInput = page.getByLabel('Email')
  await expect(emailInput).toBeDisabled()
  await expect(emailInput).toHaveValue(TEST_EMAIL)
  await expect(page.getByLabel('Country')).toHaveValue('United States')

  const orderId = await fillCheckoutAndPlace(page)
  await expect(
    page.getByRole('heading', { name: 'Order Confirmed!' })
  ).toBeVisible()

  // Order number FB-<timestamp>.
  const numberEl = page.locator('p.text-2xl.font-bold').first()
  const orderNumber = ((await numberEl.textContent()) ?? '').trim()
  expect(orderNumber).toMatch(/^FB-\d+$/)

  // Summary parity: subtotal 850, FREE shipping, total Rs 850.00.
  await expect(page.getByText(/^Rs 850\.00$/).first()).toBeVisible()

  placedOrder = { id: orderId, orderNumber }

  // LKD-10 FIXED (was BUG 5): the checkout success path refreshes the
  // zustand store BEFORE the client-side navigation, so the nav badge is
  // already gone on the confirmation page — no reload needed.
  await expect(navBadge(page)).toHaveCount(0)
  await shot(page, 'flow19-badge-cleared-instantly')

  test.info().annotations.push({
    type: 'note',
    description: `Placed order ${orderNumber} (id ${orderId}) as residue`,
  })
  await shot(page, 'flow19-confirmation')
})

// ---------------------------------------------------------------- FLOW 20b
test('FLOW 20b — LKD-28: buyer orders/payment guards land on localized login, sign-in returns', async ({
  page,
}) => {
  // Logged-OUT buyer persona: /en/orders used to dead-end at a locale-less
  // /login 404 (LKD-12's bug class on buyer pages).
  await page.context().clearCookies()
  await page.goto('/en/orders')
  await page.waitForURL(/\/en\/login\?redirect=/)
  await expect(page.getByRole('heading', { name: 'Sign In' })).toBeVisible()
  await shot(page, 'flow20b-orders-guard-login')

  // The customer's newest CONFIRMED order exercises the payment guard (the
  // page bounces PENDING orders to the order page — status rule, not auth).
  // Same setup pattern as FLOW 20: flip the newest PENDING if none exists.
  const confirmedId = runCypher(
    `MATCH (u:User {email: "${TEST_EMAIL}"})-[:PLACED_ORDER]->(o:Order {status: "CONFIRMED"}) RETURN o.id AS id ORDER BY o.createdAt DESC LIMIT 1`
  ).match(/"([^"]+)"/)?.[1]
  let orderId = confirmedId
  if (!orderId) {
    orderId = runCypher(
      `MATCH (u:User {email: "${TEST_EMAIL}"})-[:PLACED_ORDER]->(o:Order) RETURN o.id AS id ORDER BY o.createdAt DESC LIMIT 1`
    ).match(/"([^"]+)"/)?.[1]
    if (orderId) {
      runCypher(`MATCH (o:Order {id: "${orderId}"}) SET o.status = "CONFIRMED"`)
    }
  }
  test.skip(!orderId, 'customer has no orders to exercise the payment guard')
  await page.goto(`/en/order/${orderId}/payment`)
  await page.waitForURL(/\/en\/login\?redirect=/)
  await expect(page.getByRole('heading', { name: 'Sign In' })).toBeVisible()

  // Signing in from that login page RETURNS to the guarded page (validated
  // ?redirect= honored) instead of the generic shop landing. Do NOT re-goto
  // /en/login — that would drop the ?redirect= the guard appended.
  // submitLogin's per-attempt race mis-fires here: a slow sign-in that lands
  // on /payment makes attempt 2's fill wait on a page with no Email field
  // and error out even though attempt 1 succeeded. Gate the retry on the
  // URL instead — only fill while still on /login, then wait for the target.
  await page.waitForTimeout(300)
  for (let attempt = 0; attempt < 3; attempt++) {
    if (!page.url().includes('/login')) break
    await page.getByLabel('Email').fill(TEST_EMAIL)
    await page.getByLabel('Password', { exact: true }).fill(TEST_PASSWORD)
    await page.getByRole('button', { name: 'Sign In' }).click()
    await page.waitForTimeout(1500)
  }
  await page.waitForURL(new RegExp(`/en/order/${orderId}/payment$`), { timeout: 30_000 })
  await shot(page, 'flow20b-returned-to-payment')
})

// ---------------------------------------------------------------- FLOW 20
test('FLOW 20 — orders list + payment proof upload (MinIO down)', async ({
  page,
}) => {
  test.setTimeout(120_000)
  await login(page)

  // /en/orders lists the flow-19 order.
  await page.goto('/en/orders')
  await expect(page.getByRole('heading', { name: 'My Orders' })).toBeVisible()

  let target = placedOrder
  if (!target) {
    // Fallback (e.g. FLOW 19 failed earlier): use the newest order —
    // listOrders is newest-first, so take the first card's View Details link.
    const firstCard = page.locator('div.rounded-lg.bg-white.shadow-sm').first()
    const href = (await firstCard
      .getByRole('link', { name: 'View Details →' })
      .getAttribute('href')) ?? ''
    const num = ((await firstCard.locator('p.font-semibold').first().textContent()) ?? '').trim()
    const id = href.split('/').pop() ?? ''
    target = { id, orderNumber: num }
    test.info().annotations.push({
      type: 'note',
      description: `FLOW 19 state unavailable — falling back to newest order ${num}`,
    })
  }
  expect(target.orderNumber).toMatch(/^FB-/)
  const orderCard = page
    .locator('div.rounded-lg.bg-white.shadow-sm', { hasText: target.orderNumber })
    .first()
  await expect(orderCard).toBeVisible()
  await orderCard.getByRole('link', { name: 'View Details →' }).click()
  await page.waitForURL(new RegExp(`/order/${target.id}$`))
  await expect(
    page.getByRole('heading', { name: 'Order Confirmed!' })
  ).toBeVisible()

  // Fresh orders are PENDING → payment page redirects back to the order.
  await page.goto(`/en/order/${target.id}/payment`)
  await page.waitForURL(new RegExp(`/order/${target.id}$`))
  test.info().annotations.push({
    type: 'note',
    description: 'PENDING order: /payment correctly redirected back to the order detail',
  })

  // Flip to CONFIRMED (test setup — admin action is out of scope here).
  runCypher(`MATCH (o:Order {id: "${target.id}"}) SET o.status = 'CONFIRMED'`)

  await page.goto(`/en/order/${target.id}/payment`)
  await expect(page.getByRole('heading', { name: 'Payment', exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Bank Details' })).toBeVisible()
  await expect(
    page.getByRole('heading', { name: 'Upload Payment Proof' })
  ).toBeVisible()

  // Upload affordance renders: file input + upload button (disabled until
  // a file is chosen).
  const fileInput = page.locator('input[type="file"]')
  await expect(fileInput).toBeVisible()
  const uploadBtn = page.getByRole('button', { name: 'Upload Payment Proof' })
  await expect(uploadBtn).toBeDisabled()

  // Tiny PNG at /tmp/proof.png, select it, upload.
  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    'base64'
  )
  fs.writeFileSync('/tmp/proof.png', png)
  await fileInput.setInputFiles('/tmp/proof.png')
  await expect(uploadBtn).toBeEnabled()
  await expect(page.getByText('proof.png')).toBeVisible()
  await shot(page, 'flow20-payment-page')

  // MinIO is DOWN → lib/minio uploadFile rejects; the server action catches
  // and returns success:false → error Notification. App must NOT crash.
  await uploadBtn.click()
  const alert = page.locator('div[role="alert"]')
  await expect(alert).toBeVisible({ timeout: 60_000 })
  await expect(
    alert.getByRole('heading', { name: 'Failed to upload payment proof' })
  ).toBeVisible()
  // Success panel must NOT appear.
  await expect(page.getByText('Payment Proof Uploaded!')).toHaveCount(0)
  // Page still functional after the failure (exact match — the error toast
  // heading "Failed to upload payment proof" substring-matches otherwise).
  await expect(
    page.getByRole('heading', { name: 'Upload Payment Proof', exact: true })
  ).toBeVisible()
  await shot(page, 'flow20-upload-failed-minio-down')
})

// ---------------------------------------------------------------- FLOW 21
test('FLOW 21 — severed-variant regression: order survives product deletion', async ({
  page,
}) => {
  test.setTimeout(120_000)
  createQaProduct(
    QA_SEVERED.productId, QA_SEVERED.name, 'QA-SEV-001', 29.99,
    QA_SEVERED.variantId, 'S', 'Red'
  )
  await login(page)
  clearDbCart()
  await addVariant(page, QA_SEVERED.productId, 'S', 'Red')
  await page.goto('/en/checkout')
  const severedOrderId = await fillCheckoutAndPlace(page)
  await expect(
    page.getByRole('heading', { name: 'Order Confirmed!' })
  ).toBeVisible()
  const severedNumber = (
    (await page.locator('p.text-2xl.font-bold').first().textContent()) ?? ''
  ).trim()

  // Delete the product (and its variant) server-side.
  deleteQaProduct(QA_SEVERED.productId)

  // Orders LIST still renders, no crash.
  await page.goto('/en/orders')
  await expect(page.getByRole('heading', { name: 'My Orders' })).toBeVisible()

  // Order detail renders with the '(unavailable)' placeholder.
  await page.goto(`/en/order/${severedOrderId}`)
  await expect(
    page.getByRole('heading', { name: 'Order Confirmed!' })
  ).toBeVisible()
  // (DB residue note: earlier orphaned orders make '(unavailable)' appear
  // on the LIST page for older orders too — scope assertions accordingly.)
  await expect(page.getByText('(unavailable)').first()).toBeVisible()

  // Placeholder name is a SPAN, never a link (no product page to go to).
  const unavailableLink = page.locator('a', { hasText: '(unavailable)' })
  await expect(unavailableLink).toHaveCount(0)
  await expect(
    page.locator(`a[href*="/product/${QA_SEVERED.productId}"]`)
  ).toHaveCount(0)
  // The product NAME and variant SIZE are severed from the line item.
  await expect(page.getByText('QA Severed Product')).toHaveCount(0)
  await expect(page.getByText('Size: S', { exact: false })).toHaveCount(0)
  await shot(page, 'flow21-severed-order-detail')

  // The orders LIST row also de-links gracefully (scoped to THIS order's
  // card — older orphaned orders legitimately show the placeholder too).
  await page.goto('/en/orders')
  const severedCard = page.locator('div.rounded-lg.bg-white.shadow-sm', {
    hasText: severedNumber,
  })
  await expect(severedCard.getByText('(unavailable)')).toBeVisible()
  await expect(
    severedCard.locator('a', { hasText: '(unavailable)' })
  ).toHaveCount(0)
})

// ---------------------------------------------------------------- FLOW 22
test('FLOW 22 — profile persistence + homepage recently-viewed', async ({
  page,
}) => {
  test.setTimeout(90_000)
  await login(page)

  // Visit a PDP first (ProductDetailClient tracks the view on mount);
  // linger briefly so the server action completes before navigating away.
  // IMPORTANT: the engine's getRecentlyViewedProducts EXCLUDES products the
  // user has ordered or still has in cart (browsing-history.repository.ts) —
  // FLOW 19 ordered the Classic Cotton tee, so recently-viewed must be
  // exercised with a never-ordered product (Floral Summer Dress, SMOKE-BW-003).
  clearDbCart()
  await page.goto('/en/product/smoke-prod-003')
  await expect(
    page.getByRole('heading', { name: 'Floral Summer Dress' })
  ).toBeVisible()
  await page.waitForTimeout(1500)

  // Profile: preferences — add a brand and save.
  await page.goto('/en/profile')
  await expect(page.getByRole('heading', { name: 'My Profile' })).toBeVisible()
  // ProfileClient renders NO recently-viewed section (product gap, noted).
  await expect(page.getByText('Recently Viewed')).toHaveCount(0)

  await page.getByRole('button', { name: 'Shopping Preferences' }).click()
  const brandRow = page.locator('div.flex.gap-2.mb-2', {
    has: page.getByPlaceholder('e.g., Nike, Adidas'),
  })
  await brandRow.getByPlaceholder('e.g., Nike, Adidas').fill('QABrand')
  await brandRow.getByRole('button', { name: 'Add', exact: true }).click()
  await expect(
    page.locator('span.inline-flex', { hasText: 'QABrand' })
  ).toBeVisible()
  await page.getByRole('button', { name: 'Save Preferences' }).click()
  await expect(page.getByText('Preferences saved successfully!')).toBeVisible()

  // Measurements — chest value and save.
  await page.getByRole('button', { name: 'Measurements' }).click()
  const chestInput = page.locator('input[type="number"]').first()
  await chestInput.fill('100')
  await page.getByRole('button', { name: 'Save Measurements' }).click()
  await expect(page.getByText('Measurements saved successfully!')).toBeVisible()

  // Reload → both persisted server-side.
  await page.reload()
  await page.getByRole('button', { name: 'Shopping Preferences' }).click()
  await expect(
    page.locator('span.inline-flex', { hasText: 'QABrand' })
  ).toBeVisible()
  await page.getByRole('button', { name: 'Measurements' }).click()
  await expect(chestInput).toHaveValue('100')
  await shot(page, 'flow22-profile-persisted')

  // Recently-viewed lives on the HOME page for authenticated users
  // (server-rendered; retry reloads to let the tracked view land).
  let section = page.locator('section', {
    has: page.getByRole('heading', { name: 'Recently Viewed' }),
  })
  for (let i = 0; i < 3 && (await section.count()) === 0; i++) {
    await page.goto('/en')
    await page.waitForLoadState('networkidle').catch(() => {})
    await page.waitForTimeout(1000)
    section = page.locator('section', {
      has: page.getByRole('heading', { name: 'Recently Viewed' }),
    })
  }
  await expect(section).toBeVisible()
  await expect(
    section.getByRole('link', { name: /floral summer/i }).first()
  ).toBeVisible()
  await shot(page, 'flow22-recently-viewed')
})
