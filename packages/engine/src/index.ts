import * as types from './types'
import * as repositories from './repositories'
import * as db from './db'
import * as neo4jUtils from './neo4j-utils'

export const packageName = '@softx/engine'

export { createEngine, engineConfigFromEnv } from './engine'
export type { Engine, EngineConfig, TenantEngine, TenantRef } from './engine'

/**
 * @internal Migration escape hatch for code not yet on the contract
 * (admin write actions, cart/checkout, scripts). Removed in Phase 5.
 */
export const internal = { types, repositories, db, neo4jUtils }

// Flat re-exports for not-yet-migrated imports (removed in Phase 5)
export * from './types'
export { getDriver, getSession, closeDriver, runQuery, testConnection } from './db'
export { convertNeo4jIntegers } from './neo4j-utils'
export * from './repositories/product.repository'
export * from './repositories/category.repository'
export * from './repositories/promotional-category.repository'
export * from './repositories/hero-slide.repository'
export * from './repositories/cart.repository'
export * from './repositories/order.repository'
export * from './repositories/user.repository'
export * from './repositories/user-profile.repository'
export * from './repositories/color.repository'
export * from './repositories/browsing-history.repository'
export * from './repositories/recommendation.repository'
// getProductsByCategory is exported by both product.repository (deprecated)
// and promotional-category.repository; re-export explicitly to resolve the
// `export *` ambiguity. The app uses the promotional-category version.
export { getProductsByCategory } from './repositories/promotional-category.repository'
