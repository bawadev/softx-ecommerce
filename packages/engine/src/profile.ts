import { v1 } from '@softx/contract'
import type { EngineConfig, TenantRef } from './engine'
import { toProductDTO } from './mappers/catalog.mapper'
import * as userProfileRepo from './repositories/user-profile.repository'
import * as browsingRepo from './repositories/browsing-history.repository'
import * as recommendationRepo from './repositories/recommendation.repository'
import type { UserPreference, UserMeasurements } from './types'

const { ok, err } = v1

/**
 * Profile service v1 (Phase 4 Task 3): preferences/measurements reads+upserts
 * over the threaded user-profile repository, and the browsing/recommendation
 * reads that used to be app-side adapters over the raw repositories, now
 * emitted as `v1.ProductDTO[]` through the SAME catalog mapper
 * (`toProductDTO`) the catalog service uses — one ProductDTO mapper engine-wide.
 *
 * Repository-shape adaptations (verified against the repos at write time):
 * - `getUserPreferences` returns null for a user with no :UserPreference
 *   node; `getPreferences` materializes the documented default shape (empty
 *   arrays; priceRange 0–500, the app profile UI's fresh-user state) rather
 *   than NOT_FOUND.
 * - TRAP: the preferences READ path returns `priceRange` as a JSON STRING
 *   (upsertUserPreferences JSON.stringify's it; getUserPreferences never
 *   parses) — `toPreferencesDTO` parses defensively with a typeof check.
 * - TRAP: absent measurement numerics come back as MISSING keys, not null
 *   (upsertUserMeasurements writes `value || null` and Neo4j drops null
 *   properties). The DTO fields are zod `.optional()` (undefined-only), so
 *   `toMeasurementsDTO` NEVER emits null — absent stays absent. A missing
 *   `unit` defaults to 'METRIC' (block-6 conformance expectation; the repo
 *   type carries a required unit, but stale nodes may lack the property).
 * - recommendation/browsing repositories return raw Neo4j records
 *   (`record.get('p')`) shaped as ProductWithVariants; `toProductDTO`
 *   internally runs `convertNeo4jIntegers` on the row (same path as the
 *   catalog service), so no extra conversion is needed here.
 */

/** Fresh-user preferences: empty selections; priceRange mirrors the app profile UI's initial state (0–500). */
export const DEFAULT_PREFERENCES: v1.UserPreferencesDTO = {
  preferredBrands: [],
  preferredColors: [],
  preferredCategories: [],
  priceRange: { min: 0, max: 500 },
}

const DEFAULT_PRICE_RANGE = DEFAULT_PREFERENCES.priceRange

/**
 * Map an engine `UserPreference` onto `v1.UserPreferencesDTO` (drops
 * id/userId). Accepts null (no node yet) and tolerates the read path's
 * JSON-string priceRange plus missing arrays (stale/partial nodes).
 */
export function toPreferencesDTO(p: UserPreference | null): v1.UserPreferencesDTO {
  if (!p) {
    return {
      preferredBrands: [],
      preferredColors: [],
      preferredCategories: [],
      priceRange: { ...DEFAULT_PRICE_RANGE },
    }
  }
  // Read-path trap: priceRange arrives as a JSON string (upsert stringifies,
  // read doesn't parse). Parse defensively; fall back to a COPY of the
  // default on any non-object result — never the shared DEFAULT_PREFERENCES
  // object itself, or a caller mutating the DTO would corrupt the default.
  let priceRange: unknown = p.priceRange
  if (typeof priceRange === 'string') {
    try {
      priceRange = JSON.parse(priceRange)
    } catch {
      priceRange = { ...DEFAULT_PRICE_RANGE }
    }
  }
  if (typeof priceRange !== 'object' || priceRange === null) {
    priceRange = { ...DEFAULT_PRICE_RANGE }
  }
  return {
    preferredBrands: Array.isArray(p.preferredBrands) ? p.preferredBrands : [],
    preferredColors: Array.isArray(p.preferredColors) ? p.preferredColors : [],
    preferredCategories: Array.isArray(p.preferredCategories) ? p.preferredCategories : [],
    priceRange: priceRange as { min: number; max: number },
  }
}

/**
 * Map an engine `UserMeasurements` onto `v1.UserMeasurementsDTO` (drops
 * id/userId). Accepts null (no node yet → unit METRIC default) and NEVER
 * emits null: absent numeric/preferredSize keys stay absent (the DTO fields
 * are `.optional()`), and a missing unit defaults to 'METRIC'.
 */
export function toMeasurementsDTO(m: UserMeasurements | null): v1.UserMeasurementsDTO {
  if (!m) {
    return { unit: 'METRIC' }
  }
  const dto: v1.UserMeasurementsDTO = { unit: m.unit ?? 'METRIC' }
  const numericKeys = ['chest', 'waist', 'hips', 'shoulders', 'inseam', 'height', 'weight'] as const
  for (const key of numericKeys) {
    const value = m[key]
    if (value !== undefined && value !== null) {
      dto[key] = value
    }
  }
  if (m.preferredSize !== undefined && m.preferredSize !== null) {
    dto.preferredSize = m.preferredSize
  }
  return dto
}

/** Repo defaults preserved when the contract's optional `limit` is omitted. */
const RECENTLY_VIEWED_LIMIT = 10
const RECOMMENDATIONS_LIMIT = 10
const SIMILAR_PRODUCTS_LIMIT = 6

export function createProfileService(
  config: EngineConfig,
  _tenant: TenantRef
): v1.ProfileService {
  const db = config.neo4j.database
  const currency = config.defaultCurrency ?? 'LKR'

  return {
    async getPreferences(userId) {
      try {
        const p = await userProfileRepo.getUserPreferences(userId, db)
        return ok(toPreferencesDTO(p))
      } catch (e) {
        return err('UNAVAILABLE', 'Failed to get preferences', { cause: String(e) })
      }
    },

    async updatePreferences(userId, preferences) {
      const parsed = v1.UserPreferencesSchema.safeParse(preferences)
      if (!parsed.success) {
        return err('VALIDATION', 'Invalid preferences shape', {
          issues: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`),
        })
      }
      try {
        const updated = await userProfileRepo.upsertUserPreferences(
          userId,
          {
            preferredBrands: parsed.data.preferredBrands,
            preferredColors: parsed.data.preferredColors,
            preferredCategories: parsed.data.preferredCategories,
            priceRange: parsed.data.priceRange,
          },
          db
        )
        return ok(toPreferencesDTO(updated))
      } catch (e) {
        return err('UNAVAILABLE', 'Failed to update preferences', { cause: String(e) })
      }
    },

    async getMeasurements(userId) {
      try {
        const m = await userProfileRepo.getUserMeasurements(userId, db)
        return ok(toMeasurementsDTO(m))
      } catch (e) {
        return err('UNAVAILABLE', 'Failed to get measurements', { cause: String(e) })
      }
    },

    async updateMeasurements(userId, measurements) {
      const parsed = v1.UserMeasurementsSchema.safeParse(measurements)
      if (!parsed.success) {
        return err('VALIDATION', 'Invalid measurements shape', {
          issues: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`),
        })
      }
      try {
        const updated = await userProfileRepo.upsertUserMeasurements(
          userId,
          {
            chest: parsed.data.chest,
            waist: parsed.data.waist,
            hips: parsed.data.hips,
            shoulders: parsed.data.shoulders,
            inseam: parsed.data.inseam,
            height: parsed.data.height,
            weight: parsed.data.weight,
            preferredSize: parsed.data.preferredSize,
            unit: parsed.data.unit,
          },
          db
        )
        return ok(toMeasurementsDTO(updated))
      } catch (e) {
        return err('UNAVAILABLE', 'Failed to update measurements', { cause: String(e) })
      }
    },

    async trackProductView(userId, productId) {
      try {
        // The repo MATCHes both :User and :Product; a missing either side is a
        // silent no-op (repo semantics) — still an ok(null) here.
        await browsingRepo.trackProductView(userId, productId, db)
        return ok(null)
      } catch (e) {
        return err('UNAVAILABLE', 'Failed to track product view', { cause: String(e) })
      }
    },

    async listRecentlyViewed(userId, limit) {
      try {
        const rows = await browsingRepo.getRecentlyViewedProducts(
          userId,
          limit ?? RECENTLY_VIEWED_LIMIT,
          db
        )
        return ok(rows.map((p) => toProductDTO(p, currency)))
      } catch (e) {
        return err('UNAVAILABLE', 'Failed to list recently viewed', { cause: String(e) })
      }
    },

    async listRecommendations(userId, limit) {
      try {
        const rows = await recommendationRepo.getRecommendationsForUser(
          userId,
          limit ?? RECOMMENDATIONS_LIMIT,
          db
        )
        return ok(rows.map((p) => toProductDTO(p, currency)))
      } catch (e) {
        return err('UNAVAILABLE', 'Failed to list recommendations', { cause: String(e) })
      }
    },

    async listSimilarProducts(productId, limit) {
      try {
        const rows = await recommendationRepo.getSimilarProducts(
          productId,
          limit ?? SIMILAR_PRODUCTS_LIMIT,
          db
        )
        return ok(rows.map((p) => toProductDTO(p, currency)))
      } catch (e) {
        return err('UNAVAILABLE', 'Failed to list similar products', { cause: String(e) })
      }
    },
  }
}
