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
