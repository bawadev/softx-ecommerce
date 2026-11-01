import { describe, it, expect } from 'vitest'
import * as v1 from '../v1'
import { accountWorld } from './account-world'

/**
 * Shared AccountService + ProfileService v1 conformance suite (Phase 4 Task 2).
 * The suite is the spec: Task 3's engine and Task 4's fake must satisfy it.
 *
 * Parity strings pinned below are the app's CURRENT strings (copied verbatim
 * at write time; the engine ports them in Task 3):
 *   - password rules + messages — apps/factorybay/src/lib/auth.ts
 *     `validatePassword` (length → uppercase → number, in that order)
 *   - invalid-email message — apps/factorybay/src/app/actions/auth.ts
 *     signupAction/loginAction: 'Please provide a valid email address'
 *     (lib/auth.ts `isValidEmail` is regex-only and carries no message)
 *
 * Codes-only discipline: bad credentials are pinned as UNAUTHORIZED; today's
 * loginAction message for both branches is 'Invalid email or password'
 * (NOT pinned — noted here for Task 6's app mapping).
 *
 * Block 7/8 discipline (implementation-honest minimums): recently-viewed is a
 * CONTAINS assertion (the repo orders newest-first, but ordering is not
 * contractual); recommendations/similar assert array-shape + ProductDTO-parse
 * only — with this world both legitimately return [] (recommendation.repository
 * excludes already-viewed products, and products no longer carry a category,
 * so its category/brand similarity matches nothing between conformance-p1/p2).
 */
export function runAccountConformance(
  suiteName: string,
  makeService: () => v1.AccountService & v1.ProfileService & v1.CatalogService,
) {
  describe(`${suiteName}: AccountService + ProfileService v1 conformance`, () => {
    const seeded = accountWorld.user

    it('authenticate with the seeded credentials returns a hash-free AccountDTO', async () => {
      const r = await makeService().authenticate({
        email: seeded.email,
        password: accountWorld.password,
      })
      expect(r.ok).toBe(true)
      if (!r.ok) return
      expect(r.data.id).toBe(seeded.id)
      expect(r.data.email).toBe(seeded.email)
      expect(() => v1.AccountSchema.parse(r.data)).not.toThrow()
      // hashes never leave the engine — no password-ish key or value anywhere
      expect('passwordHash' in r.data).toBe(false)
      expect('password' in r.data).toBe(false)
      expect(JSON.stringify(r.data)).not.toMatch(/[Pp]assword|[Hh]ash/)
    })

    it('wrong password → UNAUTHORIZED; unknown email → UNAUTHORIZED', async () => {
      const s = makeService()
      const wrongPw = await s.authenticate({ email: seeded.email, password: 'WrongPass123!' })
      expect(wrongPw.ok).toBe(false)
      // parity: loginAction renders 'Invalid email or password' for this code
      if (!wrongPw.ok) expect(wrongPw.error.code).toBe('UNAUTHORIZED')
      const unknown = await s.authenticate({
        email: 'conformance-acct-unknown@example.com',
        password: 'Whatever123!',
      })
      expect(unknown.ok).toBe(false)
      if (!unknown.ok) expect(unknown.error.code).toBe('UNAUTHORIZED')
    })

    it('signUp creates a CUSTOMER; duplicate → CONFLICT; bad email/password → VALIDATION with parity messages', async () => {
      const s = makeService()
      const command = {
        email: 'conformance-acct-new@example.com',
        password: 'NewPass123!',
        firstName: 'New',
        lastName: 'Signup',
      }
      const created = await s.signUp(command)
      expect(created.ok).toBe(true)
      if (!created.ok) return
      expect(created.data.email).toBe(command.email)
      expect(created.data.role).toBe('CUSTOMER') // role defaults to CUSTOMER
      expect(() => v1.AccountSchema.parse(created.data)).not.toThrow()
      expect('passwordHash' in created.data).toBe(false)

      const dup = await s.signUp(command)
      expect(dup.ok).toBe(false)
      // parity: the app renders 'An account with this email already exists'
      if (!dup.ok) expect(dup.error.code).toBe('CONFLICT')

      const badEmail = await s.signUp({ ...command, email: 'not-an-email' })
      expect(badEmail.ok).toBe(false)
      if (!badEmail.ok) {
        expect(badEmail.error.code).toBe('VALIDATION')
        expect(badEmail.error.message).toBe('Please provide a valid email address')
      }

      // 7 chars, has uppercase + number → trips ONLY the length rule
      // (validatePassword checks length first, so the expected message is deterministic)
      const weak = await s.signUp({
        ...command,
        email: 'conformance-acct-weak@example.com',
        password: 'Short1!',
      })
      expect(weak.ok).toBe(false)
      if (!weak.ok) {
        expect(weak.error.code).toBe('VALIDATION')
        expect(weak.error.message).toBe('Password must be at least 8 characters long')
      }
    })

    it('getProfile returns the seeded account; unknown id → NOT_FOUND', async () => {
      const s = makeService()
      const got = await s.getProfile(seeded.id)
      expect(got.ok).toBe(true)
      if (got.ok) {
        expect(got.data.email).toBe(seeded.email)
        expect(() => v1.AccountSchema.parse(got.data)).not.toThrow()
      }
      const nobody = await s.getProfile('nobody')
      expect(nobody.ok).toBe(false)
      if (!nobody.ok) expect(nobody.error.code).toBe('NOT_FOUND')
    })

    it('preferences round-trip: unset reads as the empty default; update persists', async () => {
      const s = makeService()
      // user-profile.repository returns null for a user with no
      // :UserPreference node; the service materializes the documented
      // default (empty) shape rather than NOT_FOUND
      const before = await s.getPreferences(seeded.id)
      expect(before.ok).toBe(true)
      if (!before.ok) return
      expect(() => v1.UserPreferencesSchema.parse(before.data)).not.toThrow()
      expect(before.data.preferredBrands).toEqual([])
      expect(before.data.preferredColors).toEqual([])
      expect(before.data.preferredCategories).toEqual([])

      const prefs: v1.UserPreferencesDTO = {
        preferredBrands: ['Acme'],
        preferredColors: ['Black'],
        preferredCategories: ['SHIRT'],
        priceRange: { min: 0, max: 50000 },
      }
      const updated = await s.updatePreferences(seeded.id, prefs)
      expect(updated.ok).toBe(true)
      if (!updated.ok) return
      expect(() => v1.UserPreferencesSchema.parse(updated.data)).not.toThrow()
      expect(updated.data.preferredBrands).toEqual(['Acme'])

      const after = await s.getPreferences(seeded.id)
      expect(after.ok && after.data.preferredBrands).toEqual(['Acme'])
      expect(after.ok && after.data.preferredCategories).toEqual(['SHIRT'])
    })

    it('measurements round-trip: unset reads as the METRIC default; update persists', async () => {
      const s = makeService()
      // measurements are per-user singletons in the repo (MERGE on userId) —
      // same round-trip pattern as preferences; unset reads as the documented
      // default shape with unit METRIC
      const before = await s.getMeasurements(seeded.id)
      expect(before.ok).toBe(true)
      if (!before.ok) return
      expect(() => v1.UserMeasurementsSchema.parse(before.data)).not.toThrow()
      expect(before.data.unit).toBe('METRIC')

      const m: v1.UserMeasurementsDTO = { chest: 100, waist: 80, preferredSize: 'L', unit: 'METRIC' }
      const updated = await s.updateMeasurements(seeded.id, m)
      expect(updated.ok).toBe(true)
      if (!updated.ok) return
      expect(() => v1.UserMeasurementsSchema.parse(updated.data)).not.toThrow()
      expect(updated.data.chest).toBe(100)

      const after = await s.getMeasurements(seeded.id)
      expect(after.ok && after.data.chest).toBe(100)
      expect(after.ok && after.data.unit).toBe('METRIC')
    })

    it('trackProductView feeds listRecentlyViewed (contains); listRecommendations stays ProductDTO-shaped', async () => {
      const s = makeService()
      const tracked = await s.trackProductView(seeded.id, 'conformance-p1')
      expect(tracked.ok).toBe(true)

      const recent = await s.listRecentlyViewed(seeded.id)
      expect(recent.ok).toBe(true)
      if (!recent.ok) return
      expect(Array.isArray(recent.data)).toBe(true)
      // CONTAINS, not exact order/list: the repo orders newest-first, but the
      // contract pins membership only (implementation-honest)
      expect(recent.data.some((p) => p.id === 'conformance-p1')).toBe(true)
      for (const p of recent.data) expect(() => v1.ProductSchema.parse(p)).not.toThrow()

      const recs = await s.listRecommendations(seeded.id)
      expect(recs.ok).toBe(true)
      if (!recs.ok) return
      // may legitimately be [] (the repo excludes already-viewed products);
      // pin array-shape + ProductDTO parse only
      expect(Array.isArray(recs.data)).toBe(true)
      for (const p of recs.data) expect(() => v1.ProductSchema.parse(p)).not.toThrow()
    })

    it("listSimilarProducts('conformance-p1') returns ProductDTO-parsable entries (may be empty)", async () => {
      const r = await makeService().listSimilarProducts('conformance-p1')
      expect(r.ok).toBe(true)
      if (!r.ok) return
      // parse-only: with this world the repo's category/brand/gender matching
      // finds no sibling for conformance-p1, so [] is a passing result
      expect(Array.isArray(r.data)).toBe(true)
      for (const p of r.data) expect(() => v1.ProductSchema.parse(p)).not.toThrow()
    })
  })
}
