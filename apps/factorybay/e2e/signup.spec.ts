import { test, expect } from '@playwright/test'

/**
 * Golden journey (Phase 4 capstone): signup -> signed-in state -> PDP ->
 * profile page.
 *
 * Uses the SMOKE-* products seeded by scripts/seed-smoke-products.cypher
 * (seeding + cleanup instructions live in smoke.spec.ts's header). The PDP
 * hop targets 'Classic Cotton T-Shirt' (SMOKE-UST-001) by name, as in
 * cart.spec.ts / order.spec.ts.
 *
 * UI reality (verification duties against the real components):
 * - Signup (src/app/[locale]/signup/page.tsx, itself the client component):
 *   labeled inputs "First Name" / "Last Name" / "Email" and a password input
 *   labeled "Password" (exact match — the eye toggle carries aria-label
 *   "Show password"); "Phone number (optional)" is not required. Submit
 *   button: "Create Account". Password rules (hint + engine validation):
 *   min 8 chars, 1 uppercase, 1 number — 'Smoke123!' satisfies them. On
 *   success the page performs a FULL reload (window.location.href) to
 *   /en/shop, so the layout picks up the new auth cookie.
 * - Signed-in state (Navigation.tsx): the nav swaps the "Sign in / Sign up"
 *   link for a profile dropdown toggle (aria-label "Profile menu").
 * - Profile (page.tsx + ProfileClient.tsx): redirects anonymous users to
 *   /en/login; for a signed-in user it renders "My Profile" with three tabs
 *   (Account Info / Shopping Preferences / Measurements). The Account Info
 *   tab shows firstName/lastName/email/role as DISABLED inputs, each label
 *   associated with its input via htmlFor/id (Phase 5 Task 7 a11y fix), so
 *   getByLabel reaches them. NOTE:
 *   ProfileClient does NOT render a recently-viewed section (recently-viewed
 *   is a home-page section for authenticated users), so this spec asserts
 *   the account identity (name + email) on /en/profile instead. Visiting the
 *   PDP still fires trackProductViewAction on mount, exercising the engine
 *   browsing-history write for the fresh account along the way.
 *
 * NOTE: this spec CREATES A REAL USER in the local dev Neo4j on every run
 * (smoke+<epoch>@example.com, timestamped so reruns never CONFLICT).
 * Acceptable for a dev database, same stance as the FB orders left behind by
 * order.spec.ts — the account is intentionally NOT deleted afterwards.
 */

/**
 * Shared helper for the confirm-password cases: fills a complete, valid
 * signup form on the given surface with the supplied confirm value. The
 * submit is issued by the caller (the surfaces' buttons differ — see the
 * auth-page case for the tab/submit collision).
 */
async function fillValidSignup(
  page: import('@playwright/test').Page,
  email: string,
  password: string,
  confirm: string
) {
  await page.getByLabel('First Name').fill('Smoke')
  await page.getByLabel('Last Name').fill('Signup')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password', { exact: true }).fill(password)
  await page.getByLabel('Confirm Password').fill(confirm)
}

/**
 * LKD-42 A1+A3 — mismatched confirm password blocks signup on /en/signup:
 * the mismatch message renders inside the role="alert" error box (the a11y
 * fix from 040b743) and signupAction is never called (no POST leaves the
 * page, no navigation, form values intact). Negative controls: no alert box
 * before submit; correcting the confirm value clears the message and the
 * (matching) signup then completes and lands signed-in.
 */
test('signup with mismatched confirm password is blocked on /en/signup', async ({
  page,
}) => {
  const email = `smoke+${Date.now()}@example.com`

  // The form's role="alert" error box lives inside the .card; the layout's
  // sonner <Toaster/> also exposes an (empty) alert live region on every
  // page, so the assertions below are scoped to the card.
  const formAlert = page.locator('.card').getByRole('alert')

  await page.goto('/en/signup')

  // Negative control (A3): no error box before submit is attempted.
  await expect(formAlert).toHaveCount(0)

  // Instrument the page so a blocked signup is provable: any request the
  // server action would fire is recorded. A Next.js server action submits
  // via fetch with the Next-Action header (progressive enhancement path),
  // so counting POSTs catches both transports.
  const posts: string[] = []
  page.on('request', (req) => {
    if (req.method() === 'POST') posts.push(req.url())
  })

  await fillValidSignup(page, email, 'Password1', 'Password2')
  await page.getByRole('button', { name: 'Create Account' }).click()

  // A3: the mismatch text is announced from the existing role="alert" box.
  await expect(formAlert).toHaveText('Passwords do not match')
  // A1: still on the signup page — no navigation to /shop, nothing created.
  await expect(page).toHaveURL(/\/en\/signup$/)

  // Give a late (never-fired) action response plenty of time to surface.
  await page.waitForTimeout(1500)
  expect(posts).toEqual([])
  // The typed values survive, so the user corrects rather than retypes.
  await expect(page.getByLabel('Email')).toHaveValue(email)

  // Clearing: matching the confirm value dismisses the mismatch message.
  await page.getByLabel('Confirm Password').fill('Password1')
  await expect(formAlert).toHaveCount(0)

  // Negative control (A1): with matching values the submit completes the
  // signup and lands the user signed-in on /shop.
  await page.getByRole('button', { name: 'Create Account' }).click()
  await page.waitForURL('**/en/shop')
  await expect(
    page.getByRole('button', { name: 'Profile menu' })
  ).toBeVisible()
})

/**
 * LKD-42 A2 — the combined auth page's signup tab behaves the same. The
 * tab header ("Create Account") and the submit button share their label,
 * so the tab is switched via the header button and the submit scoped to
 * the form element. Negative control: matching passwords submit normally.
 */
test('signup with mismatched confirm password is blocked on /en/auth', async ({
  page,
}) => {
  const email = `smoke+auth-${Date.now()}@example.com`

  await page.goto('/en/auth')
  await page.getByRole('button', { name: 'Create Account' }).first().click()

  // Scoped to the card — the layout Toaster also carries an empty alert
  // live region (see the /en/signup case above).
  const formAlert = page.locator('.card').getByRole('alert')
  await expect(formAlert).toHaveCount(0)

  const posts: string[] = []
  page.on('request', (req) => {
    if (req.method() === 'POST') posts.push(req.url())
  })

  await fillValidSignup(page, email, 'Password1', 'Password2')
  await page.locator('form').getByRole('button', { name: 'Create Account' }).click()

  await expect(formAlert).toHaveText('Passwords do not match')
  await expect(page).toHaveURL(/\/en\/auth$/)

  await page.waitForTimeout(1500)
  expect(posts).toEqual([])

  // Negative control (A2): matching passwords on this surface submit
  // normally and land signed-in.
  await page.getByLabel('Confirm Password').fill('Password1')
  await page.locator('form').getByRole('button', { name: 'Create Account' }).click()
  await page.waitForURL('**/en/shop')
  await expect(
    page.getByRole('button', { name: 'Profile menu' })
  ).toBeVisible()
})
test('signup lands signed-in and reaches the profile page', async ({
  page,
}) => {
  const email = `smoke+${Date.now()}@example.com`

  // --- Sign up (full-page reload to /en/shop on success) ---
  await page.goto('/en/signup')
  await page.getByLabel('First Name').fill('Smoke')
  await page.getByLabel('Last Name').fill('Signup')
  await page.getByLabel('Email').fill(email)
  // exact: the password field's eye toggle carries aria-label "Show password"
  await page.getByLabel('Password', { exact: true }).fill('Smoke123!')
  await page.getByLabel('Confirm Password').fill('Smoke123!')
  await page.getByRole('button', { name: 'Create Account' }).click()
  await page.waitForURL('**/en/shop')

  // --- Signed-in nav: profile dropdown replaces the auth link ---
  await expect(
    page.getByRole('button', { name: 'Profile menu' })
  ).toBeVisible()
  await expect(
    page.getByRole('link', { name: 'Sign in / Sign up' })
  ).toBeHidden()

  // --- Visit a SMOKE product PDP as the new user ---
  await page.getByRole('link', { name: /classic cotton/i }).first().click()
  await page.waitForURL('**/product/**')
  await expect(page.getByText(/LKR|Rs/i).first()).toBeVisible()

  // --- Profile page: fresh account renders its own identity ---
  await page.goto('/en/profile')
  await expect(page.getByRole('heading', { name: 'My Profile' })).toBeVisible()
  // Account Info tab is the default; fields are disabled inputs with values,
  // each label associated via htmlFor/id so getByLabel reaches them.
  await expect(page.getByLabel('First Name')).toHaveValue('Smoke')
  await expect(page.getByLabel('Last Name')).toHaveValue('Signup')
  await expect(page.getByLabel('Email')).toHaveValue(email)
})
