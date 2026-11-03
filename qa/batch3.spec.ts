import { test, expect, Page, Browser, firefox } from '@playwright/test'
import { execSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

/**
 * QA BATCH 3 — admin catalog flows + admin→buyer cross-role checks, Factory Bay.
 *
 * Ground truth used for selectors (verified against component source):
 * - LKD-12 FIXED (was BUG 6): every admin page guard now redirects to the
 *   localized `/${locale}/login?redirect=/${locale}/admin/...` form
 *   (products/colors/categories/orders/inventory joined sections/hero-slides/
 *   dashboard) and lands on the real login page (200).
 * - ProductFormDialog: labels "Product Name *"/"Brand *"/"SKU"; price inputs
 *   are the two placeholder-"0.00" number inputs (stock first); categories
 *   button "Select categories" opens CategoryPickerDialog (h2 "Select
 *   Categories", leaf rows = div.cursor-pointer with a checkbox, confirm
 *   button "Confirm Selection"); variants: the size <select> is the one that
 *   has option[value="XXL"]; SizeVariantCard "+ Add Color" opens the
 *   "Add Color to Size X" overlay with a ColorPicker trigger
 *   ("Select a color..."), swatch buttons titled "black (#000000)" (COLOR_MAP
 *   fallback — DB has 0 Color nodes) and a number input.
 * - Image upload in the product dialog: hidden input[type=file]; on failure a
 *   red box (div.bg-red-50) with "Failed to upload images. Please try again."
 *   (MinIO is DOWN — the ERROR UX is the thing under test).
 * - AdminProductsClient list: tbody tr per product; row click → Edit dialog;
 *   3-dot "More options" button → "Delete Product" → ConfirmDialog (default
 *   confirm label "Confirm"). Success/error feedback = Notification component
 *   (div[role=alert] with an h3 title).
 * - CategoriesClient (sonner toasts — NO <Toaster/> is mounted anywhere in
 *   the app, so those toasts never render; assert on tree rows instead):
 *   hierarchy blocks h2 "👔 Gents" with "+ Add Root Category"; create modal
 *   h3 "Create New Category", name input placeholder "e.g., Shirts…",
 *   "Create Category" button.
 * - PromotionalCategoriesClient: "+ Create Section" → modal "Create Section"
 *   (Name/Slug/Display Order), custom Toast component (fixed top-right div)
 *   DOES render; section card click → "Products in Section", search input
 *   placeholder "Search products by name, brand, or SKU...", per-result qty
 *   input + "Add to Section" button.
 * - HeroSlidesClient: "+ Add Slide" → modal "Add New Slide". imageUrl is
 *   REQUIRED client-side; ImageUpload has a "URL" mode (url input + "Add
 *   URL", must match image extensions) — use https://example.com/x.jpg with
 *   MinIO down. Title = first text input in the modal. Reorder = buttons
 *   aria-label "Move up"/"Move down"; order badge = the numeric circle.
 *   listHeroSlides orders by displayOrder ASC → homepage hero shows the
 *   first slide initially (auto-advance later).
 * - ColorsClient: "Add New Color" form (Color Name + Hex Code inputs,
 *   "Add Color" submit); row status pill button title "Click to
 *   disable"/"Click to enable"; row Delete → ConfirmDialog. Toasts are sonner
 *   (never render — see above).
 * - PDP missing product: product/[id]/page.tsx calls notFound() → real 404.
 * - New arrivals: engine listNewArrivals = ORDER BY createdAt DESC, products
 *   with ≥1 in-stock variant → the just-created jacket is card #1.
 * - Admin edit path drops variants: AdminProductsClient.handleSubmit update
 *   branch calls updateProductAction(editingId, updates) where updates =
 *   formToUpdatePayload(...) — ProductUpdateInput carries NO variants, and
 *   the engine's addVariant is never called. Variants added/edited in the
 *   edit dialog are silently discarded (verified in code; FLOW 28 captures
 *   the runtime evidence).
 */

const REPO_ROOT = fs.existsSync(path.join(process.cwd(), 'docker-compose.yml'))
  ? process.cwd()
  : path.resolve(__dirname, '..')

const SHOTS = path.join(REPO_ROOT, '.superpowers', 'qa', 'shots')

const ADMIN_EMAIL = 'testadmin@ecommerce.com'
const ADMIN_PASSWORD = 'Admin123!'
const CUSTOMER_EMAIL = 'test@example.com'
const CUSTOMER_PASSWORD = 'Customer123!'

const JACKET = {
  name: 'QA Pilot Jacket',
  sku: 'QA-PJ-001',
  brand: 'QAFlight',
}
const HELPER_CAT = {
  id: 'qa-b3-helper-cat',
  name: 'QA Helper Category',
}
const DOOMED = {
  id: 'qa-b3-doomed',
  name: 'QA Doomed Jacket',
  variantId: 'qa-b3-doomed-var',
  sku: 'QA-DOOM-003',
}
const WINDBREAKERS = 'QA Windbreakers'
const PROMO = { name: 'QA Sale', slug: 'qa-sale' }
const SLIDE_A = 'QA Slide A'
const SLIDE_B = 'QA Slide B'
const TEAL = { name: 'QA Teal', hex: '#008080' }

/** Jacket product id captured by FLOW 24 for the later flows (workers=1). */
let jacketId = ''

/** Shared firefox browser for the buyer persona (cross-browser story). */
let buyerBrowser: Browser | null = null

/** Run a cypher statement against the docker-compose Neo4j. */
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

/** Idempotent sweep of every QA entity this batch creates. */
function cleanupAll(): void {
  const step = (label: string, fn: () => void) => {
    try {
      fn()
    } catch (e) {
      console.error(`cleanup step "${label}" failed:`, e)
    }
  }
  step('jacket', () => deleteProductBySku(JACKET.sku))
  step('doomed', () => deleteProductBySku(DOOMED.sku))
  step('helper category', () =>
    runCypher(`MATCH (c:Category {id: "${HELPER_CAT.id}"}) DETACH DELETE c`))
  step('windbreakers category', () =>
    runCypher(`MATCH (c:Category {name: "${WINDBREAKERS}"}) DETACH DELETE c`))
  step('promo section', () =>
    runCypher(`MATCH (pc:PromotionalCategory {slug: "${PROMO.slug}"}) DETACH DELETE pc`))
  step('hero slides', () =>
    runCypher(
      `MATCH (h:HeroSlide) WHERE h.title IN ["${SLIDE_A}", "${SLIDE_B}"] DETACH DELETE h`
    ))
  step('color', () =>
    runCypher(`MATCH (c:Color {name: "${TEAL.name}"}) DETACH DELETE c`))
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

/**
 * Hydration-race-guarded login (mirrors batch 1/2). NOTE: auth/page.tsx sends
 * ADMIN logins to /{locale}/admin/dashboard and customers to /{locale}/shop —
 * the navigation race accepts BOTH destinations.
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

/**
 * Add a size+color variant inside the open ProductFormDialog.
 * Size select = the <select> that owns option[value="XXL"]; color swatch
 * titles come from the COLOR_MAP fallback ("black (#000000)").
 */
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

  // The Add-Color overlay is nested INSIDE the product dialog's own fixed
  // overlay (ProductFormDialog renders it within its root) — .last() picks
  // the innermost one.
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
  // The size card now lists the color with its quantity.
  await expect(
    sizeCard.locator('span.capitalize', { hasText: colorTitlePrefix }).first()
  ).toBeVisible()
}

const navBadge = (page: Page) =>
  page.locator('nav a[href*="/cart"] span.animate-pulse').first()

test.beforeEach(() => {
  test.skip(test.info().project.name !== 'chromium', 'admin persona: chromium only')
})

test.beforeAll(() => {
  // Start from a clean slate (also sweeps leftovers from an aborted run).
  cleanupAll()
  // Leaf category required by the product form (client validation demands
  // >=1 leaf category; the dev DB ships with zero Category nodes).
  runCypher(`
    CREATE (c:Category {
      id: "${HELPER_CAT.id}",
      name: "${HELPER_CAT.name}",
      slug: "qa-helper-category",
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

// ---------------------------------------------------------------- FLOW 23
test('FLOW 23 — admin dashboard renders; non-admin blocked from admin pages', async ({
  page,
}) => {
  test.setTimeout(240_000)

  // Admin persona: login → dashboard renders.
  await login(page, ADMIN_EMAIL, ADMIN_PASSWORD)
  await page.goto('/en/admin/dashboard')
  await expect(
    page.getByRole('heading', { name: 'Admin Dashboard' })
  ).toBeVisible()
  await expect(page.getByRole('link', { name: 'Products' }).first()).toBeVisible()
  await shot(page, 'flow23-admin-dashboard')

  // Non-admin persona: the SEEDED CUSTOMER in a separate firefox browser.
  const buyer = await newBuyerPage()
  try {
    await login(buyer, CUSTOMER_EMAIL, CUSTOMER_PASSWORD)

    // LKD-12 FIXED: /en/admin/products now redirects to the LOCALIZED login
    // page (200, Sign In form) instead of the bare /login 404 dead end.
    await buyer.goto('/en/admin/products')
    await buyer.waitForURL(/\/en\/login\?redirect=/)
    await expect(
      buyer.getByRole('heading', { name: 'Sign In' })
    ).toBeVisible()
    await expect(
      buyer.getByRole('heading', { name: 'Product Management' })
    ).toHaveCount(0)
    await shot(buyer, 'flow23-customer-products-login-redirect')

    // Same for the colors admin write-path surface.
    await buyer.goto('/en/admin/colors')
    await buyer.waitForURL(/\/en\/login\?redirect=/)
    await expect(
      buyer.getByRole('heading', { name: 'Sign In' })
    ).toBeVisible()
    await expect(
      buyer.getByRole('heading', { name: 'Color Management' })
    ).toHaveCount(0)

    // And the sections page (already-correct guard) keeps landing on login.
    await buyer.goto('/en/admin/sections')
    await buyer.waitForURL(/\/en\/login/)
    await expect(
      buyer.getByRole('heading', { name: 'Sign In' })
    ).toBeVisible()
    await shot(buyer, 'flow23-customer-sections-login-redirect')
  } finally {
    await buyer.context().close()
  }
})

// ---------------------------------------------------------------- FLOW 24
test('FLOW 24 — admin creates product WITH variations via the create dialog', async ({
  page,
}) => {
  test.setTimeout(240_000)
  await login(page, ADMIN_EMAIL, ADMIN_PASSWORD)
  await page.goto('/en/admin/products')
  await expect(
    page.getByRole('heading', { name: 'Product Management' })
  ).toBeVisible()

  await page.getByRole('button', { name: 'Add Product' }).click()
  const dlg = productDialog(page)
  await expect(
    dlg.getByRole('heading', { name: 'Add New Product' })
  ).toBeVisible()

  // Identity + prices (prices = the two placeholder-0.00 inputs, stock first).
  await dlg.locator('input[placeholder="Enter product name"]').fill(JACKET.name)
  await dlg.locator('input[placeholder="Enter brand"]').fill(JACKET.brand)
  await dlg.locator('input[placeholder="Enter SKU (optional)"]').fill(JACKET.sku)
  const priceInputs = dlg.locator('input[placeholder="0.00"]')
  await priceInputs.first().fill('120.00') // stock
  await priceInputs.nth(1).fill('150.00') // retail
  await dlg
    .locator('select', { has: page.locator('option[value="MEN"]') })
    .selectOption('MEN')

  // Categories (required, leaf only).
  await dlg.getByRole('button', { name: 'Select categories' }).click()
  await pickCategories(page, [HELPER_CAT.name])

  // Variant: size M / black / qty 10.
  await addVariantInDialog(page, 'M', 'black', 10)

  await shot(page, 'flow24-dialog-filled')
  await dlg.getByRole('button', { name: 'Create Product' }).click()

  // Success notification + the optimistic list insert.
  await expect(
    page.locator('div[role="alert"]').getByRole('heading', {
      name: 'Product created successfully with variants!',
    })
  ).toBeVisible({ timeout: 60_000 })
  await expect(dlg).toHaveCount(0)

  const row = page.locator('tbody tr', { hasText: JACKET.name })
  await expect(row).toBeVisible()
  await expect(row.getByText('Rs 120.00')).toBeVisible()
  await expect(row.getByText(/1 variants/)).toBeVisible()
  await shot(page, 'flow24-product-in-list')

  // Capture the id for the cross-role flows.
  const out = runCypher(
    `MATCH (p:Product {sku: "${JACKET.sku}"}) RETURN p.id AS id`
  )
  jacketId = out.match(/"([^"]+)"/)?.[1] ?? ''
  expect(jacketId).toBeTruthy()
  test.info().annotations.push({
    type: 'note',
    description: `Created jacket id ${jacketId}`,
  })
})

// ---------------------------------------------------------------- FLOW 25
test('FLOW 25 — CROSS-ROLE: buyer (firefox) finds jacket, new-arrivals first, checks out COLLECT', async ({
  page,
}) => {
  test.setTimeout(240_000)
  test.skip(!jacketId, 'FLOW 24 did not produce the jacket')

  const buyer = await newBuyerPage()
  try {
    await login(buyer, CUSTOMER_EMAIL, CUSTOMER_PASSWORD)
    clearCustomerCart()

    // /en/shop lists the admin-created product.
    await buyer.goto('/en/shop')
    const shopCard = buyer
      .getByRole('link', { name: new RegExp(JACKET.name, 'i') })
      .first()
    await expect(shopCard).toBeVisible()

    // Home: new arrivals is newest-first → the jacket is the FIRST card.
    await buyer.goto('/en')
    const newArrivals = buyer.locator('section', {
      has: buyer.getByRole('heading', { name: 'New Arrivals' }),
    })
    await expect(newArrivals).toBeVisible()
    const firstCard = newArrivals.locator('div.grid > div').first()
    await expect(firstCard).toContainText(JACKET.name)
    await shot(buyer, 'flow25-new-arrivals-first')

    // PDP → pick M + black → add to cart.
    await buyer.goto(`/en/product/${jacketId}`)
    await expect(
      buyer.getByRole('heading', { name: JACKET.name })
    ).toBeVisible()
    const sizeRow = buyer.locator('h3:has-text("Select Size") + div')
    await sizeRow.getByRole('button', { name: 'M', exact: true }).click()
    const colorRow = buyer.locator('h3:has-text("Select Color") + div')
    await colorRow.getByRole('button', { name: /black/i }).click()
    const addToCart = buyer.getByRole('button', { name: 'Add to Cart' })
    await expect(addToCart).toBeEnabled()
    await addToCart.click()
    await expect(buyer.getByText('Added to cart!')).toBeVisible()
    await expect(navBadge(buyer)).toHaveText('1')

    // Checkout COLLECT (address section hidden; name+phone still required).
    await buyer.goto('/en/checkout')
    await buyer
      .locator('input[name="deliveryMethod"][value="COLLECT"]')
      .check()
    await expect(buyer.getByLabel('Address Line 1')).toHaveCount(0)
    await buyer.getByLabel('Full Name').fill('QA Buyer Three')
    await buyer.getByLabel('Phone Number').fill('+94 77 555 0199')
    await shot(buyer, 'flow25-collect-checkout')

    // Place-order hardening (hydration ghost-click class from batch 2):
    // navigation wins, or a "cart is empty" reload means the order WAS
    // placed — recover the id from Neo4j and navigate directly.
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
      const id = out.match(/"([^"]+)"/)?.[1] ?? ''
      await buyer.goto(`/en/order/${id}`)
    } else {
      expect(outcome).toBe('navigated')
    }
    await expect(
      buyer.getByRole('heading', { name: 'Order Confirmed!' })
    ).toBeVisible({ timeout: 30_000 })
    const orderNumber = (
      (await buyer.locator('p.text-2xl.font-bold').first().textContent()) ?? ''
    ).trim()
    expect(orderNumber).toMatch(/^FB-\d+$/)
    await shot(buyer, 'flow25-order-confirmed')
    test.info().annotations.push({
      type: 'note',
      description: `Residue: buyer order ${orderNumber} left in DB (acceptable per batch plan)`,
    })
    // Cart emptied server-side.
    await buyer.reload()
    await expect(navBadge(buyer)).toHaveCount(0)
  } finally {
    await buyer.context().close()
  }
})

// ---------------------------------------------------------------- FLOW 26
test('FLOW 26 — admin edits stock price to 99.00; buyer PDP reflects it', async ({
  page,
}) => {
  test.setTimeout(240_000)
  test.skip(!jacketId, 'FLOW 24 did not produce the jacket')

  // Admin: open the jacket row → edit dialog prefilled → 99.00 → Update.
  await login(page, ADMIN_EMAIL, ADMIN_PASSWORD)
  await page.goto('/en/admin/products')
  const row = page.locator('tbody tr', { hasText: JACKET.name })
  await expect(row).toBeVisible()
  await row.getByText(JACKET.name).click()

  const dlg = productDialog(page)
  await expect(
    dlg.getByRole('heading', { name: 'Edit Product' })
  ).toBeVisible()
  const priceInputs = dlg.locator('input[placeholder="0.00"]')
  await expect(priceInputs.first()).toHaveValue('120')
  await priceInputs.first().fill('99')
  await dlg.getByRole('button', { name: 'Update Product' }).click()
  await expect(
    page.locator('div[role="alert"]').getByRole('heading', {
      name: 'Product updated successfully!',
    })
  ).toBeVisible({ timeout: 60_000 })
  await expect(dlg).toHaveCount(0)
  await expect(row.getByText('Rs 99.00')).toBeVisible()
  await shot(page, 'flow26-price-updated-admin')

  // Buyer: hard reload of the PDP shows Rs 99.00 (retail 150 struck through).
  const buyer = await newBuyerPage()
  try {
    await buyer.goto(`/en/product/${jacketId}`)
    await expect(buyer.getByText(/^Rs 99\.00$/)).toBeVisible()
    await expect(buyer.getByText(/^Rs 150\.00$/)).toBeVisible()
    await shot(buyer, 'flow26-buyer-pdp-99')
  } finally {
    await buyer.context().close()
  }
})

// ---------------------------------------------------------------- FLOW 27
test('FLOW 27 — admin deletes product; buyer cart self-heals; stale PDP 404s', async ({
  page,
}) => {
  test.setTimeout(240_000)

  // Throwaway product (creation UX already covered by FLOW 24).
  runCypher(`
    CREATE (p:Product {id: "${DOOMED.id}", name: "${DOOMED.name}", description: 'QA batch 3 doomed product', brand: 'QABrand', gender: 'UNISEX', stockPrice: 40, retailPrice: 60, sku: "${DOOMED.sku}", category: 'JACKET', images: [], createdAt: toString(datetime()), updatedAt: toString(datetime())})
    WITH p
    CREATE (:ProductVariant {id: "${DOOMED.variantId}", productId: "${DOOMED.id}", size: "M", color: "Black", stockQuantity: 5, images: []})-[:VARIANT_OF]->(p)
  `)

  // Buyer: add it to the cart.
  const buyer = await newBuyerPage()
  try {
    await login(buyer, CUSTOMER_EMAIL, CUSTOMER_PASSWORD)
    clearCustomerCart()
    await buyer.goto(`/en/product/${DOOMED.id}`)
    const sizeRow = buyer.locator('h3:has-text("Select Size") + div')
    await sizeRow.getByRole('button', { name: 'M', exact: true }).click()
    const colorRow = buyer.locator('h3:has-text("Select Color") + div')
    await colorRow.getByRole('button', { name: /black/i }).click()
    await buyer.getByRole('button', { name: 'Add to Cart' }).click()
    await expect(buyer.getByText('Added to cart!')).toBeVisible()
    await buyer.goto('/en/cart')
    await expect(buyer.getByText('1 item in your cart')).toBeVisible()

    // Admin deletes the product through the list UI.
    await login(page, ADMIN_EMAIL, ADMIN_PASSWORD)
    await page.goto('/en/admin/products')
    const doomedRow = page.locator('tbody tr', { hasText: DOOMED.name })
    await expect(doomedRow).toBeVisible()
    await doomedRow.locator('button[title="More options"]').click()
    await page.getByRole('button', { name: 'Delete Product' }).click()
    const confirm = page.locator('div.fixed.inset-0', {
      has: page.getByRole('heading', { name: 'Delete Product' }),
    })
    await expect(confirm).toBeVisible()
    await shot(page, 'flow27-delete-confirm')
    await confirm.getByRole('button', { name: 'Confirm' }).click()
    await expect(
      page.locator('div[role="alert"]').getByRole('heading', {
        name: 'Product deleted successfully',
      })
    ).toBeVisible({ timeout: 60_000 })
    await expect(
      page.locator('tbody tr', { hasText: DOOMED.name })
    ).toHaveCount(0)
    await shot(page, 'flow27-deleted-admin')

    // Buyer cart self-heals: line gone, page renders, no crash.
    await buyer.reload()
    await expect(
      buyer.getByRole('heading', { name: 'Shopping Cart' })
    ).toBeVisible()
    await expect(buyer.getByText('Failed to load cart')).toHaveCount(0)
    await expect(buyer.getByText('Your cart is empty')).toBeVisible()
    await expect(buyer.getByText(DOOMED.name)).toHaveCount(0)
    await expect(navBadge(buyer)).toHaveCount(0)
    await shot(buyer, 'flow27-cart-self-healed')

    // Stale PDP URL: product/[id]/page.tsx notFound() → real 404.
    const res = await buyer.goto(`/en/product/${DOOMED.id}`)
    expect(res?.status()).toBe(404)
    await expect(
      buyer.getByRole('heading', { name: DOOMED.name })
    ).toHaveCount(0)
    await shot(buyer, 'flow27-stale-pdp-404')
  } finally {
    await buyer.context().close()
  }
})

// ---------------------------------------------------------------- FLOW 28
test('FLOW 28 — add size L via edit + image upload error UX (MinIO down)', async ({
  page,
}) => {
  test.setTimeout(240_000)
  test.skip(!jacketId, 'FLOW 24 did not produce the jacket')

  const variantsBefore = runCypher(
    `MATCH (v:ProductVariant)-[:VARIANT_OF]->(:Product {sku: "${JACKET.sku}"}) RETURN count(v) AS n`
  ).match(/(\d+)\s*$/)?.[1]

  await login(page, ADMIN_EMAIL, ADMIN_PASSWORD)
  await page.goto('/en/admin/products')
  const row = page.locator('tbody tr', { hasText: JACKET.name })
  await row.getByText(JACKET.name).click()

  const dlg = productDialog(page)
  await expect(
    dlg.getByRole('heading', { name: 'Edit Product' })
  ).toBeVisible()
  // Existing M variant loads into the dialog.
  await expect(
    dlg.getByRole('heading', { name: 'Size: M' })
  ).toBeVisible()

  // Image upload attempt with MinIO DOWN — the error UX is the target.
  fs.writeFileSync(
    '/tmp/qa-b3-jacket.png',
    Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
      'base64'
    )
  )
  await dlg.locator('input[type="file"]').setInputFiles('/tmp/qa-b3-jacket.png')
  const uploadError = dlg.locator('div.bg-red-50', {
    hasText: 'Failed to upload images',
  })
  await expect(uploadError).toBeVisible({ timeout: 90_000 })
  // Graceful: dialog still open and functional, no crash overlay.
  await expect(
    dlg.getByRole('heading', { name: 'Edit Product' })
  ).toBeVisible()
  await shot(page, 'flow28-upload-error-ux')

  // Add size L / black / qty 5 through the edit dialog.
  await addVariantInDialog(page, 'L', 'black', 5)
  await expect(
    dlg.getByRole('heading', { name: 'Size: L' })
  ).toBeVisible()
  await shot(page, 'flow28-size-L-added-dialog')

  await dlg.getByRole('button', { name: 'Update Product' }).click()
  await expect(
    page.locator('div[role="alert"]').getByRole('heading', {
      name: 'Product updated successfully!',
    })
  ).toBeVisible({ timeout: 60_000 })

  // LKD-11 FIXED (was batch-3 BUG 7): the update branch now reconciles the
  // dialog's variants via the engine write paths, so the L variant persists.
  await expect
    .poll(
      () =>
        runCypher(
          `MATCH (v:ProductVariant {size: "L"})-[:VARIANT_OF]->(:Product {sku: "${JACKET.sku}"}) RETURN count(v) AS n`
        ).match(/(\d+)\s*$/)?.[1],
      { timeout: 15_000 }
    )
    .toBe('1')
  const variantsAfter = runCypher(
    `MATCH (v:ProductVariant)-[:VARIANT_OF]->(:Product {sku: "${JACKET.sku}"}) RETURN count(v) AS n`
  ).match(/(\d+)\s*$/)?.[1]
  expect(Number(variantsAfter)).toBe(Number(variantsBefore) + 1)
  await shot(page, 'flow28-after-update')

  // Buyer PDP: L is now offered alongside M.
  const buyer = await newBuyerPage()
  try {
    await buyer.goto(`/en/product/${jacketId}`)
    const sizeRow = buyer.locator('h3:has-text("Select Size") + div')
    await expect(sizeRow.getByRole('button', { name: 'M', exact: true })).toBeVisible()
    await expect(sizeRow.getByRole('button', { name: 'L', exact: true })).toBeVisible()
    await shot(buyer, 'flow28-buyer-sees-L')
  } finally {
    await buyer.context().close()
  }
})

// ---------------------------------------------------------------- FLOW 29
test('FLOW 29 — admin category create + assign; buyer filters by it', async ({
  page,
}) => {
  test.setTimeout(240_000)
  test.skip(!jacketId, 'FLOW 24 did not produce the jacket')

  // Create 'QA Windbreakers' under Gents. NOTE: CategoriesClient toasts via
  // sonner but no <Toaster/> is mounted app-wide — the success toast NEVER
  // renders; assert on the refreshed tree instead.
  await login(page, ADMIN_EMAIL, ADMIN_PASSWORD)
  await page.goto('/en/admin/categories')
  const gentsBlock = page.locator('div.bg-white', {
    has: page.getByRole('heading', { name: '👔 Gents' }),
  })
  await gentsBlock.getByRole('button', { name: '+ Add Root Category' }).click()
  const createDlg = page.locator('div.fixed.inset-0', {
    has: page.getByRole('heading', { name: 'Create New Category' }),
  })
  await createDlg
    .locator('input[placeholder="e.g., Shirts, Dresses, Toys"]')
    .fill(WINDBREAKERS)
  await createDlg.getByRole('button', { name: 'Create Category' }).click()
  await expect(createDlg).toHaveCount(0, { timeout: 30_000 })
  // LKD-13: the sonner success toast actually renders now.
  await expect(page.locator('[data-sonner-toast]')).toContainText(
    'Category created successfully'
  )
  await expect(gentsBlock.getByText(WINDBREAKERS, { exact: true })).toBeVisible()
  await shot(page, 'flow29-category-created')

  // Assign the jacket via the product edit dialog's category picker.
  await page.goto('/en/admin/products')
  const row = page.locator('tbody tr', { hasText: JACKET.name })
  await row.getByText(JACKET.name).click()
  const dlg = productDialog(page)
  await dlg.getByRole('button', { name: /selected|Select categories/ }).click()
  await pickCategories(page, [WINDBREAKERS])
  await dlg.getByRole('button', { name: 'Update Product' }).click()
  await expect(
    page.locator('div[role="alert"]').getByRole('heading', {
      name: 'Product updated successfully!',
    })
  ).toBeVisible({ timeout: 60_000 })

  // Category id from the DB (deterministic filter URL).
  const catId = runCypher(
    `MATCH (c:Category {name: "${WINDBREAKERS}"}) RETURN c.id AS id`
  ).match(/"([^"]+)"/)?.[1]
  expect(catId).toBeTruthy()

  // Buyer: category-filtered shop lists the jacket.
  const buyer = await newBuyerPage()
  try {
    await buyer.goto(`/en/shop?category=${catId}`)
    await expect(
      buyer.getByRole('heading', { name: WINDBREAKERS })
    ).toBeVisible()
    await expect(
      buyer.getByRole('link', { name: new RegExp(JACKET.name, 'i') }).first()
    ).toBeVisible()
    await shot(buyer, 'flow29-shop-category-filter')

    // Home: root-category chip bar exposes the new category.
    await buyer.goto('/en')
    const chip = buyer.locator('section.sticky button', {
      hasText: WINDBREAKERS,
    })
    await expect(chip).toBeVisible()
  } finally {
    await buyer.context().close()
  }
})

// ---------------------------------------------------------------- FLOW 30
test('FLOW 30 — promo section create + jacket allocation; buyer home shows it', async ({
  page,
}) => {
  test.setTimeout(240_000)
  test.skip(!jacketId, 'FLOW 24 did not produce the jacket')

  await login(page, ADMIN_EMAIL, ADMIN_PASSWORD)
  await page.goto('/en/admin/sections')
  await expect(
    page.getByRole('heading', { name: 'Promotional Sections' })
  ).toBeVisible()

  await page.getByRole('button', { name: '+ Create Section' }).click()
  const createDlg = page.locator('div.fixed.inset-0', {
    has: page.getByRole('heading', { name: 'Create Section' }),
  })
  await createDlg.locator('input[placeholder="e.g., Christmas Deals 2025"]').fill(PROMO.name)
  await createDlg.locator('input[placeholder="e.g., christmas-deals-2025"]').fill(PROMO.slug)
  await createDlg.getByRole('button', { name: 'Create', exact: true }).click()

  // Custom Toast component (this one IS mounted) + the section card.
  await expect(page.locator('div.fixed.top-4.right-4')).toContainText(
    'Section created successfully!',
    { timeout: 30_000 }
  )
  const sectionCard = page.locator('div.border-2', { hasText: PROMO.name }).first()
  await expect(sectionCard).toBeVisible()
  await shot(page, 'flow30-section-created')

  // Open the section, search the jacket, allocate qty 5.
  await sectionCard.click()
  await expect(
    page.getByRole('heading', { name: 'Products in Section' })
  ).toBeVisible()
  const searchInput = page.getByPlaceholder(
    'Search products by name, brand, or SKU...'
  )
  await searchInput.fill(JACKET.name)
  await page.getByRole('button', { name: 'Search', exact: true }).click()

  const resultCard = page.locator('div.bg-white.rounded-lg.border-2', {
    hasText: JACKET.name,
  })
  await expect(resultCard).toBeVisible({ timeout: 30_000 })
  await resultCard.locator('input[type="number"]').fill('5')
  await resultCard.getByRole('button', { name: 'Add to Section' }).click()
  await expect(page.locator('div.fixed.top-4.right-4')).toContainText(
    'Product added successfully!',
    { timeout: 30_000 }
  )
  const allocatedRow = page.locator('div.flex.items-center.gap-4', {
    hasText: JACKET.name,
  })
  await expect(allocatedRow).toBeVisible()
  await expect(allocatedRow.getByText('This Section:')).toContainText('5')
  await shot(page, 'flow30-jacket-allocated')

  // Buyer: home renders the promo section with the jacket inside.
  const buyer = await newBuyerPage()
  try {
    await buyer.goto('/en')
    const promoSection = buyer.locator('section', {
      has: buyer.getByRole('heading', { name: PROMO.name }),
    })
    await expect(promoSection).toBeVisible()
    await expect(
      promoSection
        .getByRole('link', { name: new RegExp(JACKET.name, 'i') })
        .first()
    ).toBeVisible()
    await shot(buyer, 'flow30-buyer-home-promo')
  } finally {
    await buyer.context().close()
  }
})

// ---------------------------------------------------------------- FLOW 31
test('FLOW 31 — hero slide create via URL image + reorder; buyer sees it', async ({
  page,
}) => {
  test.setTimeout(240_000)

  const createSlide = async (title: string, subtitle: string) => {
    await page.getByRole('button', { name: '+ Add Slide' }).first().click()
    const modal = page.locator('div.fixed.inset-0', {
      has: page.getByRole('heading', { name: 'Add New Slide' }),
    })
    await expect(modal).toBeVisible()
    // imageUrl is REQUIRED — MinIO is down, so use ImageUpload's URL mode
    // with a plain https URL ending in .jpg (extension-validated). The modal
    // has two <section>s (desktop first, mobile second) — scope to .first().
    const desktop = modal.locator('section').first()
    await expect(desktop.getByText('Desktop Slide')).toBeVisible()
    await desktop.getByRole('button', { name: 'URL', exact: true }).click()
    await desktop.locator('input[type="url"]').fill('https://example.com/x.jpg')
    await desktop.getByRole('button', { name: 'Add URL' }).click()
    const titleInputs = modal.locator('input[type="text"]')
    await titleInputs.first().fill(title)
    await titleInputs.nth(1).fill(subtitle)
    await modal.getByRole('button', { name: 'Create Slide' }).click()
    await expect(
      page.locator('div[role="alert"]').getByRole('heading', {
        name: 'Slide created',
      })
    ).toBeVisible({ timeout: 30_000 })
  }

  await login(page, ADMIN_EMAIL, ADMIN_PASSWORD)
  await page.goto('/en/admin/hero-slides')
  // exact: the empty-state h3 "No hero slides" also substring-matches.
  await expect(
    page.getByRole('heading', { name: 'Hero Slides', exact: true })
  ).toBeVisible()

  await createSlide(SLIDE_A, 'batch3 first slide')
  const slideCardA = page
    .locator('div.bg-white.rounded-lg.border', { hasText: SLIDE_A })
    .first()
  await expect(slideCardA).toBeVisible()
  await createSlide(SLIDE_B, 'batch3 second slide')
  const slideCardB = page
    .locator('div.bg-white.rounded-lg.border', { hasText: SLIDE_B })
    .first()
  await expect(slideCardB).toBeVisible()
  await shot(page, 'flow31-two-slides')

  // Order badges before: A=1, B=2.
  const badge = (card: ReturnType<Page['locator']>) =>
    card.locator('div.rounded-full.text-sm.font-bold')
  await expect(badge(slideCardA)).toHaveText('1')
  await expect(badge(slideCardB)).toHaveText('2')

  // Reorder: move B up (reorder IS supported by the UI).
  await slideCardB.getByRole('button', { name: 'Move up' }).click()
  await page.waitForTimeout(1000)
  await expect(badge(slideCardB)).toHaveText('1')
  await expect(badge(slideCardA)).toHaveText('2')
  await shot(page, 'flow31-reordered')

  // displayOrder persisted (listHeroSlides orders by displayOrder ASC).
  const orderRows = runCypher(
    `MATCH (h:HeroSlide) WHERE h.title IN ["${SLIDE_A}", "${SLIDE_B}"] RETURN h.title AS t, h.displayOrder AS o ORDER BY o`
  )
  test.info().annotations.push({
    type: 'note',
    description: `Hero displayOrder after reorder:\n${orderRows}`,
  })

  // Buyer: homepage hero shows the FIRST slide (now B) initially.
  const buyer = await newBuyerPage()
  try {
    await buyer.goto('/en')
    const hero = buyer.locator('div.relative.overflow-hidden.bg-black-900')
    await expect(hero).toBeVisible()
    // The slide title renders twice inside the panel (span + h2) — .first().
    await expect(hero.getByText(SLIDE_B, { exact: false }).first()).toBeVisible({
      timeout: 20_000,
    })
    await shot(buyer, 'flow31-buyer-hero')
  } finally {
    await buyer.context().close()
  }
})

// ---------------------------------------------------------------- FLOW 32
test('FLOW 32 — colors CRUD (create/toggle/delete) + admin-only surface', async ({
  page,
}) => {
  test.setTimeout(240_000)

  await login(page, ADMIN_EMAIL, ADMIN_PASSWORD)
  await page.goto('/en/admin/colors')
  await expect(
    page.getByRole('heading', { name: 'Color Management' })
  ).toBeVisible()

  // Create 'QA Teal' #008080. NOTE: success toast is sonner — never renders
  // (no <Toaster/> mounted); assert on the list row instead. The form labels
  // are not htmlFor-associated — target by placeholder.
  await page.getByPlaceholder('e.g. Midnight Blue').fill(TEAL.name)
  await page.getByPlaceholder('#000000').fill(TEAL.hex)
  await page.getByRole('button', { name: 'Add Color' }).click()

  // LKD-13: the sonner success toast renders now ('Color "QA Teal" created').
  await expect(page.locator('[data-sonner-toast]')).toContainText(/created/i)
  const tealRow = page.locator('tbody tr', { hasText: TEAL.hex })
  await expect(tealRow).toBeVisible({ timeout: 30_000 })
  await expect(tealRow.getByText(TEAL.name, { exact: false })).toBeVisible()
  await shot(page, 'flow32-teal-created')

  // Toggle → disabled (line-through styling + Disabled pill).
  await tealRow.locator('button[title="Click to disable"]').click()
  await expect(
    tealRow.getByText('Disabled', { exact: true })
  ).toBeVisible({ timeout: 30_000 })
  await shot(page, 'flow32-teal-disabled')

  // Delete → confirm → row gone.
  await tealRow.getByRole('button', { name: 'Delete' }).click()
  const confirm = page.locator('div.fixed.inset-0', {
    has: page.getByRole('heading', { name: 'Delete Color' }),
  })
  await expect(confirm).toBeVisible()
  await confirm.getByRole('button', { name: 'Confirm' }).click()
  await expect(
    page.locator('tbody tr', { hasText: TEAL.hex })
  ).toHaveCount(0, { timeout: 30_000 })
  await shot(page, 'flow32-teal-deleted')

  // makeUserAdmin security: no admin user-management page exists in the UI;
  // the admin surface (/en/admin + /en/admin/dashboard) is admin-only. As the
  // CUSTOMER the dashboard guard blocks entry (localized redirect → login).
  // The makeUserAdmin ACTION itself is guarded server-side (code-verified in
  // Phase 5: actions/admin.ts requires an authenticated ADMIN; engine enforces
  // the admin actor) — active probing via crafted action calls is out of
  // scope for browser QA per the batch plan.
  const buyer = await newBuyerPage()
  try {
    await login(buyer, CUSTOMER_EMAIL, CUSTOMER_PASSWORD)
    await buyer.goto('/en/admin')
    await buyer.waitForURL(/\/en\/login/)
    await expect(
      buyer.getByRole('heading', { name: 'Admin Dashboard' })
    ).toHaveCount(0)
    await shot(buyer, 'flow32-customer-admin-blocked')

    // LKD-16 FIXED: the dev utility page itself is now admin-gated — a
    // logged-in CUSTOMER gets a 404 instead of the Make User Admin form
    // (previously the form rendered to anyone; only the action rejected).
    const res = await buyer.goto('/en/dev/make-admin')
    expect(res?.status()).toBe(404)
    await expect(buyer.getByRole('heading', { name: 'Make User Admin' })).toHaveCount(0)
    await shot(buyer, 'flow32-make-admin-gated-404')
  } finally {
    await buyer.context().close()
  }
  test.info().annotations.push({
    type: 'note',
    description:
      'makeUserAdmin guard code-verified (actions/admin.ts isAdmin check + engine actor); no active probing. LKD-16: /en/dev/make-admin now 404s for non-admins (page gated, not just the action).',
  })
})
