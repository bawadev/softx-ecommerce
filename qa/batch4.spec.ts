import { test, expect, Page, Browser, firefox } from '@playwright/test'
import { execSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

/**
 * QA BATCH 4 — cross-role order status, admin payment-proof surface,
 * live tenant isolation (factorybay vs acornbay), batch-3 HIGH bug re-verify.
 *
 * Ground truth used for selectors (verified against component source):
 * - AdminOrdersClient (/en/admin/orders): h1 "Order Management"; one card per
 *   order (div.bg-white.rounded-lg with the orderNumber in a p.font-semibold);
 *   getAllOrders = ORDER BY o.createdAt DESC → newest order is card #1.
 *   Status pill renders the RAW status ("CONFIRMED"/"CANCELLED"); status
 *   control = "Update Status" row with buttons "Confirm" / "Mark as Fulfilled"
 *   / "Cancel" (Cancel disabled only when status is CANCELLED or FULFILLED —
 *   CONFIRMED→CANCELLED is reachable). Success feedback = Notification
 *   (div[role=alert] h3 "Order status updated successfully", autoClose=false).
 *   The card has NO payment-proof column/link — paymentProof is never
 *   referenced anywhere in the admin surface (product gap, noted).
 * - OrdersPageClient (/en/orders): status pill renders tStatus(status) —
 *   "Pending"/"Confirmed"/"Cancelled" (en.json order.status.*), NOT the raw
 *   enum. Card = div.rounded-lg.bg-white.shadow-sm scoped by orderNumber.
 * - OrderConfirmationClient (order detail, admin "View Details" target): no
 *   payment-proof area either; proof UI exists ONLY on the buyer's
 *   /order/{id}/payment page (CONFIRMED-only, upload-only).
 * - acornbay template app (localhost:3100, own Neo4j container on :7601):
 *   /shop renders h1 "Shop", "N products in this store", h3.product-name per
 *   card; PDP price row renders `{currency} {amount}` via its own price lib —
 *   "LKR 59.00" (ISO code, NOT the "Rs" symbol factorybay uses; the task's
 *   "Rs price" expectation is adjusted to the actual template display).
 * - LKD-11 (was batch-3 BUG 7) FIXED: the update branch reconciles the
 *   dialog's variants (id-threaded through ProductFormDialog) via
 *   addVariantAction/updateVariantAction/deleteVariantAction — regression
 *   test LKD-11 (formerly B3-RV, which asserted the bug).
 */

const REPO_ROOT = fs.existsSync(path.join(process.cwd(), 'docker-compose.yml'))
  ? process.cwd()
  : path.resolve(__dirname, '..')

const SHOTS = path.join(REPO_ROOT, '.superpowers', 'qa', 'shots')

const ADMIN_EMAIL = 'testadmin@ecommerce.com'
const ADMIN_PASSWORD = 'Admin123!'
const CUSTOMER_EMAIL = 'test@example.com'
const CUSTOMER_PASSWORD = 'Customer123!'

const ACORNBAY = 'http://localhost:3100'
const ACORN_PRODUCTS = ['Acorn Hoodie', 'Acorn Cap', 'Acorn Tote']

const HELPER_CAT = { id: 'qa-b4-helper-cat', name: 'QA B4 Helper Category' }
const CANARY = {
  name: 'QA Tenant Canary',
  sku: 'QA-TENANT-001',
  brand: 'QAIsolation',
}
const EDIT_PROBE = {
  name: 'QA Edit Probe',
  sku: 'QA-EDIT-004',
  brand: 'QAIsolation',
}

/** Order placed by FLOW 33, reused by FLOW 34 (same worker, workers=1). */
let placedOrder: { id: string; orderNumber: string } | null = null

/** Shared firefox browser for the buyer persona (cross-browser story). */
let buyerBrowser: Browser | null = null

/** Run a cypher statement against the factorybay docker-compose Neo4j. */
function runCypher(cypher: string): string {
  const quoted = `'${cypher.replace(/'/g, `'\\''`)}'`
  return execSync(
    `docker compose exec -T neo4j cypher-shell -u neo4j -p ecommerce123 ${quoted}`,
    { cwd: REPO_ROOT, stdio: ['ignore', 'pipe', 'pipe'] }
  ).toString()
}

function deleteProductBySku(sku: string): void {
  runCypher(`
    MATCH (p:Product {sku: "${sku}"})
    OPTIONAL MATCH (v:ProductVariant)-[:VARIANT_OF]->(p)
    DETACH DELETE p, v
  `)
}

function cleanupAll(): void {
  const step = (label: string, fn: () => void) => {
    try {
      fn()
    } catch (e) {
      console.error(`cleanup step "${label}" failed:`, e)
    }
  }
  step('canary', () => deleteProductBySku(CANARY.sku))
  step('edit probe', () => deleteProductBySku(EDIT_PROBE.sku))
  step('helper category', () =>
    runCypher(`MATCH (c:Category {id: "${HELPER_CAT.id}"}) DETACH DELETE c`))
  step('customer cart', () =>
    runCypher(
      `MATCH (u:User {email: "${CUSTOMER_EMAIL}"})-[r:HAS_CART_ITEM]->(c:CartItem) DETACH DELETE c`
    ))
}

const browserName = () => test.info().project.name

async function shot(page: Page, name: string) {
  fs.mkdirSync(SHOTS, { recursive: true })
  await page.screenshot({
    path: path.join(SHOTS, `${name}-${browserName()}.png`),
    fullPage: true,
  })
}

/** Hydration-race-guarded login (mirrors batch 1–3; accepts both role destinations). */
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
      page
        .waitForURL(/\/en\/(shop|admin\/dashboard)$/, { timeout: 8000 })
        .then(() => 'navigated' as const),
      page.locator('div.bg-red-50').first().waitFor({ timeout: 8000 }).then(() => 'error' as const),
      page.waitForTimeout(2500).then(() => 'settled' as const),
    ])
    if (outcome === 'navigated' || outcome === 'error') return outcome
  }
  throw new Error('Login submit was never handled by React (hydration race)')
}

async function login(page: Page, email: string, password: string): Promise<void> {
  await page.goto('/en/login')
  await page.waitForLoadState('networkidle').catch(() => {})
  await page.waitForTimeout(300)
  const outcome = await submitLogin(page, email, password)
  expect(outcome).toBe('navigated')
}

/** Fresh buyer persona page in a separate FIREFOX browser (own cookies). */
async function newBuyerPage(): Promise<Page> {
  if (!buyerBrowser) buyerBrowser = await firefox.launch()
  const ctx = await buyerBrowser.newContext({ baseURL: 'http://localhost:3000' })
  return ctx.newPage()
}

function clearCustomerCart(): void {
  runCypher(
    `MATCH (u:User {email: "${CUSTOMER_EMAIL}"})-[r:HAS_CART_ITEM]->(c:CartItem) DETACH DELETE c`
  )
}

/** Add a variant to the cart from the factorybay PDP (size + color pickers). */
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

/** The ProductFormDialog overlay (fixed inset-0, h2 Add/Edit Product). */
const productDialog = (page: Page) =>
  page.locator('div.fixed.inset-0', {
    has: page.getByRole('heading', { name: /^Add New Product$|^Edit Product$/ }),
  })

/** Pick a leaf category inside the CategoryPickerDialog and confirm. */
async function pickCategories(page: Page, names: string[]): Promise<void> {
  const picker = page.locator('div.fixed.inset-0', {
    has: page.getByRole('heading', { name: 'Select Categories' }),
  })
  await expect(picker).toBeVisible()
  for (const name of names) {
    const row = picker.locator('div.cursor-pointer', { hasText: name }).first()
    await row.locator('input[type="checkbox"]').check()
  }
  await picker.getByRole('button', { name: 'Confirm Selection' }).click()
  await expect(picker).toHaveCount(0)
}

/** Add a size+color variant inside the open ProductFormDialog (batch-3 helper). */
async function addVariantInDialog(
  page: Page,
  size: string,
  colorTitlePrefix: string,
  qty: number
): Promise<void> {
  const dlg = productDialog(page)
  const sizeSelect = dlg.locator('select', {
    has: page.locator('option[value="XXL"]'),
  })
  await sizeSelect.selectOption(size)

  const sizeCard = dlg.locator('div.border.rounded-lg.bg-white', {
    has: page.getByRole('heading', { name: `Size: ${size}` }),
  })
  await expect(sizeCard).toBeVisible()
  await sizeCard.getByRole('button', { name: '+ Add Color' }).click()

  const colorDlg = page
    .locator('div.fixed.inset-0', {
      has: page.getByRole('heading', { name: `Add Color to Size ${size}` }),
    })
    .last()
  await expect(colorDlg).toBeVisible()
  await colorDlg.locator('button', { hasText: 'Select a color...' }).click()
  await colorDlg.locator(`button[title^="${colorTitlePrefix}"]`).first().click()
  await colorDlg.locator('input[type="number"]').fill(String(qty))
  await colorDlg.getByRole('button', { name: 'Add Color', exact: true }).click()
  await expect(colorDlg).toHaveCount(0)
  await expect(
    sizeCard.locator('span.capitalize', { hasText: colorTitlePrefix }).first()
  ).toBeVisible()
}

/** Create a product WITH one M/black variant through the real admin dialog. */
async function adminCreateProduct(
  page: Page,
  name: string,
  sku: string,
  brand: string
): Promise<void> {
  await page.goto('/en/admin/products')
  await expect(
    page.getByRole('heading', { name: 'Product Management' })
  ).toBeVisible()
  await page.getByRole('button', { name: 'Add Product' }).click()
  const dlg = productDialog(page)
  await expect(
    dlg.getByRole('heading', { name: 'Add New Product' })
  ).toBeVisible()
  await dlg.locator('input[placeholder="Enter product name"]').fill(name)
  await dlg.locator('input[placeholder="Enter brand"]').fill(brand)
  await dlg.locator('input[placeholder="Enter SKU (optional)"]').fill(sku)
  const priceInputs = dlg.locator('input[placeholder="0.00"]')
  await priceInputs.first().fill('66.00')
  await priceInputs.nth(1).fill('88.00')
  await dlg
    .locator('select', { has: page.locator('option[value="MEN"]') })
    .selectOption('MEN')
  await dlg.getByRole('button', { name: 'Select categories' }).click()
  await pickCategories(page, [HELPER_CAT.name])
  await addVariantInDialog(page, 'M', 'black', 12)
  await dlg.getByRole('button', { name: 'Create Product' }).click()
  await expect(
    page.locator('div[role="alert"]').getByRole('heading', {
      name: 'Product created successfully with variants!',
    })
  ).toBeVisible({ timeout: 60_000 })
  await expect(dlg).toHaveCount(0)
  await expect(page.locator('tbody tr', { hasText: name })).toBeVisible()
}

test.beforeEach(() => {
  test.skip(test.info().project.name !== 'chromium', 'admin persona: chromium only')
})

test.beforeAll(() => {
  cleanupAll()
  // Leaf category required by the product form (dev DB ships with zero
  // Category nodes; same prerequisite as batch 3).
  runCypher(`
    CREATE (c:Category {
      id: "${HELPER_CAT.id}",
      name: "${HELPER_CAT.name}",
      slug: "qa-b4-helper-category",
      hierarchy: "gents",
      parentId: null,
      level: 0,
      isActive: true,
      isFeatured: false,
      createdAt: toString(datetime()),
      updatedAt: toString(datetime())
    })
  `)
})

test.afterAll(() => {
  cleanupAll()
  buyerBrowser?.close().catch(() => {})
})

// ---------------------------------------------------------------- FLOW 33
test('FLOW 33 — CROSS-ROLE order status: buyer orders → admin CONFIRMED → buyer CANCELLED', async ({
  page,
}) => {
  test.setTimeout(300_000)

  // ---- 1. Buyer (firefox) places a COLLECT order for the SMOKE tee.
  const buyer = await newBuyerPage()
  let orderNumber = ''
  let orderId = ''
  try {
    await login(buyer, CUSTOMER_EMAIL, CUSTOMER_PASSWORD)
    clearCustomerCart()
    await addVariant(buyer, 'smoke-prod-001', 'M', 'White')
    await buyer.goto('/en/checkout')
    await buyer
      .locator('input[name="deliveryMethod"][value="COLLECT"]')
      .check()
    await expect(buyer.getByLabel('Address Line 1')).toHaveCount(0)
    await buyer.getByLabel('Full Name').fill('QA Buyer Four')
    await buyer.getByLabel('Phone Number').fill('+94 77 555 0330')

    // Hardened place-order (hydration ghost-click class, batches 2–3).
    await buyer.getByRole('button', { name: 'Place Order' }).click()
    const outcome = await Promise.race([
      buyer
        .waitForURL(/\/en\/order\/[^/]+$/, { timeout: 60_000 })
        .then(() => 'navigated' as const),
      buyer
        .locator('div.bg-red-50', { hasText: 'cart is empty' })
        .waitFor({ timeout: 60_000 })
        .then(() => 'ghost-placed' as const),
      buyer.waitForTimeout(62_000).then(() => 'settled' as const),
    ])
    if (outcome === 'ghost-placed') {
      const out = runCypher(
        `MATCH (u:User {email: "${CUSTOMER_EMAIL}"})-[:PLACED_ORDER]->(o:Order) RETURN o.id AS id ORDER BY o.createdAt DESC LIMIT 1`
      )
      orderId = out.match(/"([^"]+)"/)?.[1] ?? ''
      await buyer.goto(`/en/order/${orderId}`)
    } else {
      expect(outcome).toBe('navigated')
      orderId = buyer.url().split('/').pop() ?? ''
    }
    await expect(
      buyer.getByRole('heading', { name: 'Order Confirmed!' })
    ).toBeVisible({ timeout: 30_000 })
    orderNumber = (
      (await buyer.locator('p.text-2xl.font-bold').first().textContent()) ?? ''
    ).trim()
    expect(orderNumber).toMatch(/^FB-\d+$/)
    placedOrder = { id: orderId, orderNumber }
    // Baseline: buyer's own list renders the fresh order as "Pending".
    await buyer.goto('/en/orders')
    const buyerCard = buyer
      .locator('div.rounded-lg.bg-white.shadow-sm', { hasText: orderNumber })
      .first()
    await expect(buyerCard).toBeVisible()
    await expect(
      buyerCard.locator('span.inline-block.rounded-full')
    ).toHaveText('Pending')
    await shot(buyer, 'flow33-buyer-pending')
  } finally {
    await buyer.context().close()
  }

  // ---- 2. Admin (chromium) finds the order and CONFIRMS it.
  await login(page, ADMIN_EMAIL, ADMIN_PASSWORD)
  await page.goto('/en/admin/orders')
  await expect(
    page.getByRole('heading', { name: 'Order Management' })
  ).toBeVisible()

  const adminCard = page
    .locator('div.bg-white.rounded-lg', { hasText: orderNumber })
    .first()
  await expect(adminCard).toBeVisible()
  // Admin pill renders the RAW status enum.
  await expect(
    adminCard.locator('span.inline-block.rounded-full')
  ).toHaveText('PENDING')
  await shot(page, 'flow33-admin-pending')

  // Status control: "Update Status" row → "Confirm" button.
  // NOTE: an EMPTY div[role=alert] lives in the Next.js dev overlay's shadow
  // DOM on every page — always scope notification locators by its heading.
  const statusNotif = (title: string) =>
    page.locator('div[role="alert"]', { hasText: title })
  await expect(adminCard.getByText('Update Status')).toBeVisible()
  await adminCard.getByRole('button', { name: 'Confirm', exact: true }).click()
  await expect(
    statusNotif('Order status updated successfully').getByRole('heading', {
      name: 'Order status updated successfully',
    })
  ).toBeVisible({ timeout: 30_000 })
  await expect(
    adminCard.locator('span.inline-block.rounded-full')
  ).toHaveText('CONFIRMED')
  await shot(page, 'flow33-admin-confirmed')
  // The Notification is a MODAL (fixed inset-0 backdrop intercepts pointer
  // events, autoClose=false) — dismiss it before the next status click.
  await statusNotif('Order status updated successfully')
    .getByRole('button', { name: 'OK' })
    .click()
  await expect(statusNotif('Order status updated successfully')).toHaveCount(0)

  // ---- 3. Buyer hard-reloads → status renders "Confirmed" (tStatus label).
  const buyer2 = await newBuyerPage()
  try {
    await login(buyer2, CUSTOMER_EMAIL, CUSTOMER_PASSWORD)
    await buyer2.goto('/en/orders') // fresh load (hard navigation)
    const card2 = buyer2
      .locator('div.rounded-lg.bg-white.shadow-sm', { hasText: orderNumber })
      .first()
    await expect(card2).toBeVisible()
    await expect(
      card2.locator('span.inline-block.rounded-full')
    ).toHaveText('Confirmed')
    await shot(buyer2, 'flow33-buyer-confirmed')
  } finally {
    await buyer2.context().close()
  }

  // ---- 4. Admin CANCELLED (Cancel enabled from CONFIRMED) → buyer "Cancelled".
  await adminCard.getByRole('button', { name: 'Cancel', exact: true }).click()
  await expect(
    statusNotif('Order status updated successfully').getByRole('heading', {
      name: 'Order status updated successfully',
    })
  ).toBeVisible({ timeout: 30_000 })
  await statusNotif('Order status updated successfully')
    .getByRole('button', { name: 'OK' })
    .click()
  await expect(statusNotif('Order status updated successfully')).toHaveCount(0)
  await expect(
    adminCard.locator('span.inline-block.rounded-full')
  ).toHaveText('CANCELLED')
  await shot(page, 'flow33-admin-cancelled')

  const buyer3 = await newBuyerPage()
  try {
    await buyer3.goto('/en/login')
    await buyer3.waitForLoadState('networkidle').catch(() => {})
    await buyer3.waitForTimeout(300)
    const outcome = await submitLogin(buyer3, CUSTOMER_EMAIL, CUSTOMER_PASSWORD)
    expect(outcome).toBe('navigated')
    await buyer3.goto('/en/orders')
    const card3 = buyer3
      .locator('div.rounded-lg.bg-white.shadow-sm', { hasText: orderNumber })
      .first()
    await expect(card3).toBeVisible()
    await expect(
      card3.locator('span.inline-block.rounded-full')
    ).toHaveText('Cancelled')
    await shot(buyer3, 'flow33-buyer-cancelled')
    test.info().annotations.push({
      type: 'note',
      description: `Cross-role status round-trip proven on ${orderNumber} (id ${orderId}); order left as CANCELLED residue`,
    })
  } finally {
    await buyer3.context().close()
  }
})

// ---------------------------------------------------------------- FLOW 34
test('FLOW 34 — admin orders surface renders payment-proof-less orders without crashing', async ({
  page,
}) => {
  test.setTimeout(240_000)

  // DB ground truth: does ANY order carry a proof string? (Batch 2's uploads
  // all failed against down MinIO — expected none.)
  const proofRows = runCypher(
    'MATCH (o:Order) WHERE o.paymentProof IS NOT NULL RETURN o.orderNumber AS n, o.paymentProof AS p LIMIT 10'
  )
  const proofCount = runCypher(
    'MATCH (o:Order) WHERE o.paymentProof IS NOT NULL RETURN count(o) AS n'
  ).match(/(\d+)\s*$/)?.[1]
  test.info().annotations.push({
    type: 'note',
    description: `Orders with a paymentProof string in DB: ${proofCount ?? '?'}${proofRows.trim() ? `\n${proofRows}` : ' (none — batch-2 residue confirmed proofless)'}`,
  })

  await login(page, ADMIN_EMAIL, ADMIN_PASSWORD)
  await page.goto('/en/admin/orders')
  await expect(
    page.getByRole('heading', { name: 'Order Management' })
  ).toBeVisible()

  // The whole list renders: every card has its items, address and the
  // status control (no crash on proof-less orders).
  const cards = page.locator('div.bg-white.rounded-lg', {
    has: page.locator('span.inline-block.rounded-full'),
  })
  const cardCount = await cards.count()
  expect(cardCount).toBeGreaterThan(0)
  test.info().annotations.push({
    type: 'note',
    description: `Admin orders list rendered ${cardCount} order cards without crashing`,
  })

  // Our flow-33 order (if available) renders its full card incl. status row.
  if (placedOrder) {
    const card = page
      .locator('div.bg-white.rounded-lg', { hasText: placedOrder.orderNumber })
      .first()
    await expect(card).toBeVisible()
    await expect(card.getByText('Update Status')).toBeVisible()
    await expect(card.getByText('🏪 Collect')).toBeVisible()
  }

  // LKD-15 FIXED (was a product gap): every admin order card now carries a
  // payment-proof surface — "No payment proof" when the order has none.
  await expect(page.getByText('No payment proof').first()).toBeVisible()

  // LKD-14 FIXED (was BUG 9): the storefront order detail page now falls
  // back to the admin read when the ownership check blocks an admin, so the
  // admin "View Details" link renders the customer's order instead of 404.
  if (placedOrder) {
    // LKD-14: the admin fallback read renders the customer's order.
    await page.goto(`/en/order/${placedOrder.id}`)
    await expect(
      page.getByRole('heading', { name: 'Order Confirmed!' })
    ).toBeVisible()
    await expect(page.getByText(placedOrder.orderNumber)).toBeVisible()
    test.info().annotations.push({
      type: 'note',
      description: `Admin "View Details" on /en/admin/orders → /en/order/${placedOrder.id} renders the customer's order (LKD-14 admin fallback read)`,
    })
    await shot(page, 'flow34-admin-view-details-renders')

    // LKD-15: seed a proof directly on the node (MinIO is down, so the
    // buyer upload path can't produce one) — the detail page and the admin
    // card both surface it.
    runCypher(
      `MATCH (o:Order {id: "${placedOrder.id}"}) SET o.paymentProof = "https://qa-storage.example/proofs/${placedOrder.orderNumber}.png"`
    )
    await page.reload()
    await expect(page.locator('a', { hasText: 'View payment proof' })).toBeVisible()
    await shot(page, 'flow34-detail-payment-proof')

    await page.goto('/en/admin/orders')
    const proofLink = page
      .locator('tbody tr, div.bg-white.rounded-lg', { hasText: placedOrder.orderNumber })
      .locator('a', { hasText: 'Payment Proof →' })
      .first()
    await expect(proofLink).toBeVisible()
    await shot(page, 'flow34-admin-card-payment-proof')
  }
  await shot(page, 'flow34-admin-orders-list')
})

// ---------------------------------------------------------------- FLOW 35
test('FLOW 35 — tenant isolation live: factorybay canary invisible to acornbay', async ({
  page,
}) => {
  test.setTimeout(300_000)

  // ---- 1. Admin creates the canary in FACTORYBAY via the real UI.
  await login(page, ADMIN_EMAIL, ADMIN_PASSWORD)
  await adminCreateProduct(page, CANARY.name, CANARY.sku, CANARY.brand)
  const canaryOut = runCypher(
    `MATCH (p:Product {sku: "${CANARY.sku}"}) RETURN p.id AS id`
  )
  const canaryId = canaryOut.match(/"([^"]+)"/)?.[1] ?? ''
  expect(canaryId).toBeTruthy()
  await shot(page, 'flow35-canary-created-factorybay')

  // ---- 2. Buyer checks ACORNBAY (own container, own engine binding):
  const buyer = await newBuyerPage()
  try {
    await buyer.goto(`${ACORNBAY}/shop`)
    await expect(buyer.getByRole('heading', { name: 'Shop', exact: true })).toBeVisible()
    // acornbay's OWN products are all present...
    for (const name of ACORN_PRODUCTS) {
      await expect(
        buyer.locator('h3.product-name', { hasText: name })
      ).toBeVisible()
    }
    // ...and the canary is ABSENT (name AND product-card text).
    await expect(buyer.getByText(CANARY.name)).toHaveCount(0)
    await expect(buyer.getByText(CANARY.brand)).toHaveCount(0)
    await shot(buyer, 'flow35-acornbay-shop-no-canary')

    // Acorn PDP renders its price with the tenant's currency display
    // (template shows the ISO code "LKR", not factorybay's "Rs" symbol).
    await buyer.goto(`${ACORNBAY}/product/acornbay-product-hoodie`)
    await expect(
      buyer.getByRole('heading', { name: 'Acorn Hoodie' })
    ).toBeVisible()
    await expect(buyer.locator('.pdp-price')).toHaveText('LKR 59.00')
    await expect(buyer.locator('.pdp-price-was')).toHaveText('LKR 72.00')
    // NOTE: acornbay's template renders the ISO currency code ("LKR"), not
    // factorybay's "Rs" symbol — asserted as-built (its price.ts formats
    // `{m.currency} {amount}`). No "Rs" SYMBOL appears in the price row.
    await expect(buyer.locator('.pdp-price-row')).not.toContainText('Rs')
    await shot(buyer, 'flow35-acornbay-pdp-lkr-price')

    // ---- 3. Same buyer on FACTORYBAY: canary PRESENT in the shop.
    await buyer.goto('/en/shop')
    await expect(
      buyer.getByRole('link', { name: new RegExp(CANARY.name, 'i') }).first()
    ).toBeVisible()
    await shot(buyer, 'flow35-factorybay-shop-canary-present')
  } finally {
    await buyer.context().close()
  }

  // ---- 4. Repo-level check while the canary is LIVE:
  // npm run verify:tenants must be green AND list the canary under
  // factorybay only (proves disjointness against the live node).
  const verifyOut = execSync('npm run verify:tenants', {
    cwd: REPO_ROOT,
    env: { ...process.env, NEO4J_PASSWORD: 'ecommerce123' },
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: 120_000,
  }).toString()
  expect(verifyOut).toContain('TENANT ISOLATION PROVEN')
  // Product lines are indented ("  products (N): ...") per tenant section,
  // in tenant order: factorybay first, acornbay second.
  const productLines = verifyOut
    .split('\n')
    .filter((l) => /^\s*products \(\d+\):/.test(l))
  expect(productLines.length).toBe(2)
  const factoryLine = productLines[0]
  const acornLine = productLines[1]
  expect(factoryLine!).toContain(CANARY.name)
  expect(acornLine!).not.toContain(CANARY.name)
  test.info().annotations.push({
    type: 'note',
    description: `verify:tenants (with live canary) — factorybay line includes '${CANARY.name}', acornbay line does not; script exit 0\n${verifyOut.trim().split('\n').slice(0, 8).join('\n')}`,
  })

  // ---- 5. Delete the canary through the admin UI (delete path, batch-3 style).
  await page.goto('/en/admin/products')
  const row = page.locator('tbody tr', { hasText: CANARY.name })
  await expect(row).toBeVisible()
  await row.locator('button[title="More options"]').click()
  await page.getByRole('button', { name: 'Delete Product' }).click()
  const confirm = page.locator('div.fixed.inset-0', {
    has: page.getByRole('heading', { name: 'Delete Product' }),
  })
  await expect(confirm).toBeVisible()
  await confirm.getByRole('button', { name: 'Confirm' }).click()
  await expect(
    page.locator('div[role="alert"]').getByRole('heading', {
      name: 'Product deleted successfully',
    })
  ).toBeVisible({ timeout: 60_000 })
  await expect(page.locator('tbody tr', { hasText: CANARY.name })).toHaveCount(0)

  // DB-level confirmation on BOTH tenants' containers.
  const fbGone = runCypher(
    `MATCH (p:Product {sku: "${CANARY.sku}"}) RETURN count(p) AS n`
  ).match(/(\d+)\s*$/)?.[1]
  expect(fbGone).toBe('0')
  const acornGone = execSync(
    `docker exec ecom-acornbay-neo4j cypher-shell -u neo4j -p acornbay123 'MATCH (p:Product) WHERE p.name = "${CANARY.name}" RETURN count(p) AS n'`,
    { stdio: ['ignore', 'pipe', 'pipe'] }
  ).toString()
  expect(acornGone.match(/(\d+)\s*$/)?.[1]).toBe('0')
  await shot(page, 'flow35-canary-deleted')
})

// ------------------------------------------------- LKD-11 (regression: variant edits persist)
test('LKD-11 — edit-dialog variant changes persist on save (add, qty edit, delete)', async ({
  page,
}) => {
  test.setTimeout(300_000)

  // Fresh throwaway product with one variant (M/black), created via the UI.
  await login(page, ADMIN_EMAIL, ADMIN_PASSWORD)
  await adminCreateProduct(page, EDIT_PROBE.name, EDIT_PROBE.sku, EDIT_PROBE.brand)

  const sku = EDIT_PROBE.sku
  const countQuery = `MATCH (v:ProductVariant)-[:VARIANT_OF]->(:Product {sku: "${sku}"}) RETURN count(v) AS n`
  const countOf = () => runCypher(countQuery).match(/(\d+)\s*$/)?.[1]
  // stockQuantity is a FLOAT in Neo4j (cypher-shell prints "4.0") — parse the
  // whole number, digits after the decimal point included.
  const stockOf = (size: string): number | undefined => {
    const m = runCypher(
      `MATCH (v:ProductVariant {size: "${size}"})-[:VARIANT_OF]->(:Product {sku: "${sku}"}) RETURN v.stockQuantity AS q`
    ).match(/(\d+(?:\.\d+)?)\s*$/)
    return m ? parseFloat(m[1]) : undefined
  }
  expect(countOf()).toBe('1')

  const row = () => page.locator('tbody tr', { hasText: EDIT_PROBE.name })

  // Stage 1 — ADD a size L variant in the edit dialog and save.
  await page.goto('/en/admin/products')
  await row().getByText(EDIT_PROBE.name).click()
  const dlg = productDialog(page)
  await expect(dlg.getByRole('heading', { name: 'Edit Product' })).toBeVisible()
  await expect(dlg.getByRole('heading', { name: 'Size: M' })).toBeVisible()
  await addVariantInDialog(page, 'L', 'black', 4)
  await shot(page, 'lkd11-edit-dialog-with-L')
  await dlg.getByRole('button', { name: 'Update Product' }).click()
  await expect(
    page.locator('div[role="alert"]').getByRole('heading', {
      name: 'Product updated successfully!',
    })
  ).toBeVisible({ timeout: 60_000 })
  await expect(dlg).toHaveCount(0)

  await expect
    .poll(countOf, { timeout: 15_000 })
    .toBe('2')
  expect(stockOf('L')).toBe(4)
  await expect(row().getByText(/2 variants/)).toBeVisible()

  // Stage 2 — EDIT the existing M variant's quantity 12 → 7 and save.
  // Fresh navigation: the sticky success toast overlays the row otherwise.
  await page.goto('/en/admin/products')
  await row().getByText(EDIT_PROBE.name).click()
  await expect(dlg.getByRole('heading', { name: 'Edit Product' })).toBeVisible()
  // has: must root at `page` — a has-locator derived from the already-filtered
  // `dlg` does not re-root and never matches (0 results).
  const mCard = dlg.locator('div.border.rounded-lg.bg-white', {
    has: page.getByRole('heading', { name: 'Size: M' }),
  })
  await mCard.locator('input[type="number"]').fill('7')
  await dlg.getByRole('button', { name: 'Update Product' }).click()
  await expect(
    page.locator('div[role="alert"]').getByRole('heading', {
      name: 'Product updated successfully!',
    })
  ).toBeVisible({ timeout: 60_000 })
  await expect(dlg).toHaveCount(0)
  await expect.poll(() => stockOf('M'), { timeout: 15_000 }).toBe(7)

  // Stage 3 — DELETE the M size entirely (Remove → Confirm) and save.
  await page.goto('/en/admin/products')
  await row().getByText(EDIT_PROBE.name).click()
  await expect(dlg.getByRole('heading', { name: 'Edit Product' })).toBeVisible()
  await mCard.getByRole('button', { name: 'Remove', exact: true }).click()
  await page.getByRole('button', { name: 'Confirm', exact: true }).click()
  await expect(dlg.getByRole('heading', { name: 'Size: M' })).toHaveCount(0)
  await dlg.getByRole('button', { name: 'Update Product' }).click()
  await expect(
    page.locator('div[role="alert"]').getByRole('heading', {
      name: 'Product updated successfully!',
    })
  ).toBeVisible({ timeout: 60_000 })
  await expect(dlg).toHaveCount(0)

  await expect.poll(countOf, { timeout: 15_000 }).toBe('1')
  expect(stockOf('M')).toBeUndefined()
  expect(stockOf('L')).toBe(4)

  // Buyer PDP reflects the final state: L offered, M gone.
  const probeId = runCypher(
    `MATCH (p:Product {sku: "${sku}"}) RETURN p.id AS id`
  ).match(/"([^"]+)"/)?.[1]
  const buyer = await newBuyerPage()
  try {
    await buyer.goto(`/en/product/${probeId}`)
    const sizeRow = buyer.locator('h3:has-text("Select Size") + div')
    await expect(sizeRow.getByRole('button', { name: 'L', exact: true })).toBeVisible()
    await expect(sizeRow.getByRole('button', { name: 'M', exact: true })).toHaveCount(0)
    await shot(buyer, 'lkd11-buyer-sees-L-not-M')
  } finally {
    await buyer.context().close()
  }
})
