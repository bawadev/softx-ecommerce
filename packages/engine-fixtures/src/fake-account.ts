// Fake AccountService + ProfileService v1 — in-memory users, preferences,
// measurements and per-user recently-viewed arrays over the catalog fixture
// world (worldProducts). The fake cannot import engine code, so every
// engine-owned string/rule below is DUPLICATED with a parity comment — keep
// them in lockstep with packages/engine/src/account.ts + profile.ts (themselves
// verbatim ports of the app's lib/auth.ts strings).
//
// Password "hashing": the fake stores the literal `fake:<password>` marker and
// verifies by string equality — bcrypt-equivalent FOR THE SUITE (the marker is
// engine-opaque in exactly the way a bcrypt hash is: it never appears in any
// DTO, and verify is the only way to check a password against it). This is the
// marker account-world.ts documents for the fake-engine seeding path.
//
// `v1` (ok/err) comes from the contract root; the test world fixtures come
// from the `@softx/contract/testing` subpath.
import { v1 } from '@softx/contract'
import { worldProducts, accountWorld } from '@softx/contract/testing'

const { ok, err } = v1

// ---------------------------------------------------------------------------
// Parity strings/rules — duplicated from packages/engine/src/account.ts
// (verbatim ports of apps/factorybay/src/lib/auth.ts + auth actions).
// ---------------------------------------------------------------------------

/** parity with engine/src/account.ts INVALID_EMAIL_MESSAGE */
const INVALID_EMAIL_MESSAGE = 'Please provide a valid email address'
/** parity with engine/src/account.ts (app's 'An account with this email already exists') */
const DUPLICATE_EMAIL_MESSAGE = 'An account with this email already exists'
/** parity with engine/src/account.ts UNAUTHORIZED message ('Invalid email or password') */
const BAD_CREDENTIALS_MESSAGE = 'Invalid email or password'
/** parity with engine/src/profile.ts VALIDATION messages on update */
const INVALID_PREFERENCES_MESSAGE = 'Invalid preferences shape'
const INVALID_MEASUREMENTS_MESSAGE = 'Invalid measurements shape'

/**
 * Validate email format.
 * Parity with engine/src/account.ts isValidEmail (and the app's lib/auth.ts
 * regex) — duplicated, not imported.
 */
function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

/**
 * Validate password strength and return error message.
 * Parity with engine/src/account.ts validatePassword (exact rules, messages
 * and order — length first for determinism) — duplicated, not imported.
 */
function validatePassword(password: string): string | null {
  if (password.length < 8) {
    return 'Password must be at least 8 characters long'
  }
  if (!/[A-Z]/.test(password)) {
    return 'Password must contain at least one uppercase letter'
  }
  if (!/[0-9]/.test(password)) {
    return 'Password must contain at least one number'
  }
  return null
}

/**
 * Fresh-user preferences — parity with engine/src/profile.ts
 * DEFAULT_PREFERENCES (the app profile UI's initial state): empty selections,
 * priceRange 0–500.
 */
const DEFAULT_PREFERENCES: v1.UserPreferencesDTO = {
  preferredBrands: [],
  preferredColors: [],
  preferredCategories: [],
  priceRange: { min: 0, max: 500 },
}

/** parity with engine/src/profile.ts — unset measurements read as unit METRIC */
const DEFAULT_MEASUREMENTS: v1.UserMeasurementsDTO = { unit: 'METRIC' }

/** parity with accountWorld.seedCypher's fixed timestamps */
const SEED_TS = '2026-01-01T00:00:00.000Z'

/** Repo defaults preserved when the contract's optional `limit` is omitted. */
const RECENTLY_VIEWED_LIMIT = 10
const RECOMMENDATIONS_LIMIT = 10
const SIMILAR_PRODUCTS_LIMIT = 6

/** The fake's password "hash": the literal marker compared by equality. */
const fakeHash = (password: string): string => `fake:${password}`

/** Stored user = AccountDTO projection + the hash (the repo-row shape). */
interface FakeUser extends v1.AccountDTO {
  passwordHash: string
}

/** One :ProductView row — seq is the monotonic stand-in for viewedAt. */
interface FakeView {
  productId: string
  seq: number
}

/** Copy helpers — reads return fresh objects like DB round-trips do. */
function copyPreferences(p: v1.UserPreferencesDTO): v1.UserPreferencesDTO {
  return {
    preferredBrands: [...p.preferredBrands],
    preferredColors: [...p.preferredColors],
    preferredCategories: [...p.preferredCategories],
    priceRange: { ...p.priceRange },
  }
}

function copyMeasurements(m: v1.UserMeasurementsDTO): v1.UserMeasurementsDTO {
  return { ...m }
}

/** AccountDTO projection — the single choke point keeping the hash inside. */
function toAccountDTO(user: FakeUser): v1.AccountDTO {
  const { passwordHash: _passwordHash, ...dto } = user
  return dto
}

/**
 * Shared per-runner fake account state: the users map plus BOTH services the
 * account conformance runner composes. The profile service's
 * trackProductView/list* read the same users map (view tracking is a no-op
 * for unknown users, mirroring the repo's double MATCH), so a runner must
 * build ONE state instance and share it — exactly like
 * `createFakeEngine().for()` does.
 */
export interface FakeAccountState {
  users: Map<string, FakeUser>
  preferences: Map<string, v1.UserPreferencesDTO>
  measurements: Map<string, v1.UserMeasurementsDTO>
  views: Map<string, FakeView[]>
  accountService: v1.AccountService
  profileService: v1.ProfileService
}

export function createFakeAccountState(): FakeAccountState {
  // Pre-seeded to mirror accountWorld.seedCypher(fakeHash(password)) — the
  // conformance suite authenticates THIS account; without it the first block
  // fails UNAUTHORIZED.
  const users = new Map<string, FakeUser>([
    [
      accountWorld.user.id,
      {
        id: accountWorld.user.id,
        email: accountWorld.user.email,
        role: 'CUSTOMER',
        firstName: accountWorld.user.firstName,
        lastName: accountWorld.user.lastName,
        passwordHash: fakeHash(accountWorld.password),
        createdAt: SEED_TS,
        updatedAt: SEED_TS,
      },
    ],
  ])
  const preferences = new Map<string, v1.UserPreferencesDTO>()
  const measurements = new Map<string, v1.UserMeasurementsDTO>()
  const views = new Map<string, FakeView[]>()

  /** Mirror of user.repository: emails are stored/matched lowercased. */
  const findByEmail = (email: string): FakeUser | undefined =>
    [...users.values()].find((u) => u.email === email.toLowerCase())

  let viewSeq = 0

  const accountService: v1.AccountService = {
    async signUp(command) {
      // Mirrors the engine's check order: email format → password strength
      // → duplicate → "hash" → create.
      if (!isValidEmail(command.email)) {
        return err('VALIDATION', INVALID_EMAIL_MESSAGE)
      }
      const passwordError = validatePassword(command.password)
      if (passwordError) {
        return err('VALIDATION', passwordError)
      }
      if (findByEmail(command.email)) {
        return err('CONFLICT', DUPLICATE_EMAIL_MESSAGE)
      }
      // parity with user.repository.createUser: uuid id, lowercased email,
      // role default CUSTOMER, phone stored only when provided, now() stamps.
      const now = new Date().toISOString()
      const user: FakeUser = {
        id: crypto.randomUUID(),
        email: command.email.toLowerCase(),
        role: command.role ?? 'CUSTOMER',
        firstName: command.firstName,
        lastName: command.lastName,
        ...(command.phone !== undefined ? { phone: command.phone } : {}),
        passwordHash: fakeHash(command.password),
        createdAt: now,
        updatedAt: now,
      }
      users.set(user.id, user)
      return ok(toAccountDTO(user))
    },

    async authenticate(credentials) {
      // Engine parity: invalid email shape is VALIDATION; unknown email and
      // wrong password are both UNAUTHORIZED with the parity message.
      if (!isValidEmail(credentials.email)) {
        return err('VALIDATION', INVALID_EMAIL_MESSAGE)
      }
      const user = findByEmail(credentials.email)
      if (!user) {
        return err('UNAUTHORIZED', BAD_CREDENTIALS_MESSAGE)
      }
      // bcrypt.compare equivalent: equality against the fake marker.
      if (user.passwordHash !== fakeHash(credentials.password)) {
        return err('UNAUTHORIZED', BAD_CREDENTIALS_MESSAGE)
      }
      return ok(toAccountDTO(user))
    },

    async getProfile(userId) {
      const user = users.get(userId)
      return user
        ? ok(toAccountDTO(user))
        : err('NOT_FOUND', `User ${userId} not found`)
    },
  }

  const profileService: v1.ProfileService = {
    async getPreferences(userId) {
      // Repo returns null when no :UserPreference node exists → the engine
      // materializes the default shape (not NOT_FOUND); same for any userId.
      return ok(copyPreferences(preferences.get(userId) ?? DEFAULT_PREFERENCES))
    },

    async updatePreferences(userId, preferencesInput) {
      const parsed = v1.UserPreferencesSchema.safeParse(preferencesInput)
      if (!parsed.success) {
        return err('VALIDATION', INVALID_PREFERENCES_MESSAGE, {
          issues: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`),
        })
      }
      preferences.set(userId, parsed.data)
      return ok(copyPreferences(parsed.data))
    },

    async getMeasurements(userId) {
      // Same null-node semantics as preferences; unset unit reads as METRIC.
      return ok(copyMeasurements(measurements.get(userId) ?? DEFAULT_MEASUREMENTS))
    },

    async updateMeasurements(userId, measurementsInput) {
      const parsed = v1.UserMeasurementsSchema.safeParse(measurementsInput)
      if (!parsed.success) {
        return err('VALIDATION', INVALID_MEASUREMENTS_MESSAGE, {
          issues: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`),
        })
      }
      measurements.set(userId, parsed.data)
      return ok(copyMeasurements(parsed.data))
    },

    async trackProductView(userId, productId) {
      // Repo parity: the Cypher MATCHes BOTH the :User and the :Product; a
      // missing either side creates nothing — a silent ok(null), not NOT_FOUND.
      if (!users.has(userId)) return ok(null)
      if (!worldProducts.some((p) => p.id === productId)) return ok(null)
      const list = views.get(userId) ?? []
      list.push({ productId, seq: ++viewSeq })
      views.set(userId, list)
      return ok(null)
    },

    async listRecentlyViewed(userId, limit) {
      // Repo parity: group by product keeping the LAST view (max(viewedAt)),
      // newest first, limit applied after ordering. Divergence (deliberate):
      // the engine's query also drops products already in the user's cart or
      // a live order — the fake order service keeps its orders private, so
      // the fake models the browsing-history core only (nothing in the
      // conformance world carts or orders a viewed product).
      const perProduct = new Map<string, number>()
      for (const view of views.get(userId) ?? []) {
        perProduct.set(view.productId, Math.max(perProduct.get(view.productId) ?? 0, view.seq))
      }
      const ordered = [...perProduct.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([productId]) => worldProducts.find((p) => p.id === productId))
        .filter((p): p is v1.ProductDTO => p !== undefined)
        .slice(0, limit ?? RECENTLY_VIEWED_LIMIT)
      return ok(ordered)
    },

    async listRecommendations(userId, limit) {
      // Mirror of recommendation.repository.getRecommendationsForUser over
      // worldProducts: candidates share a brand (or category) with something
      // the user viewed, EXCLUDE already-viewed products, need an in-stock
      // variant, and sort by score (brand 2 / category 1) then createdAt DESC.
      // ProductDTO carries no category (products no longer have one — the
      // catalog world's :Product nodes don't either), so the category term is
      // vacuous, exactly as the engine query behaves against this world: a
      // user whose only view is conformance-p1 (brand Acme) gets [] because
      // conformance-p2 (Boralus) matches neither term.
      const viewed = views.get(userId) ?? []
      const viewedIds = new Set(viewed.map((v) => v.productId))
      const viewedBrands = new Set(
        viewed
          .map((v) => worldProducts.find((p) => p.id === v.productId)?.brand)
          .filter((b): b is string => b !== undefined),
      )
      const candidates = worldProducts
        .filter((p) => !viewedIds.has(p.id) && viewedBrands.has(p.brand))
        .filter((p) => p.variants.some((variant) => variant.stockQuantity > 0))
        .map((p) => ({ p, score: 2 })) // brand match only — category never applies
      candidates.sort((a, b) => b.score - a.score || b.p.createdAt.localeCompare(a.p.createdAt))
      return ok(candidates.slice(0, limit ?? RECOMMENDATIONS_LIMIT).map((c) => c.p))
    },

    async listSimilarProducts(productId, limit) {
      // Mirror of recommendation.repository.getSimilarProducts: same category
      // or brand as the current product (category vacuous here — see above),
      // never the product itself, in-stock variants, score
      // (category 2 /) brand 1 / gender 1, createdAt DESC. An unknown
      // productId yields no rows in the engine (the opening MATCH fails) —
      // ok([]), not NOT_FOUND.
      const current = worldProducts.find((p) => p.id === productId)
      if (!current) return ok([])
      const candidates = worldProducts
        .filter((p) => p.id !== productId)
        .filter((p) => p.brand === current.brand)
        .filter((p) => p.variants.some((variant) => variant.stockQuantity > 0))
        .map((p) => ({
          p,
          score:
            (p.brand === current.brand ? 1 : 0) + (p.gender === current.gender ? 1 : 0),
        }))
      candidates.sort((a, b) => b.score - a.score || b.p.createdAt.localeCompare(a.p.createdAt))
      return ok(candidates.slice(0, limit ?? SIMILAR_PRODUCTS_LIMIT).map((c) => c.p))
    },
  }

  return { users, preferences, measurements, views, accountService, profileService }
}
