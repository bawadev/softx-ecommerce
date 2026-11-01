import * as repositories from './repositories'
import * as db from './db'
import * as neo4jUtils from './neo4j-utils'

export const packageName = '@softx/engine'

export { createEngine, engineConfigFromEnv } from './engine'
export type { Engine, EngineConfig, TenantEngine, TenantRef } from './engine'

// ---------------------------------------------------------------------------
// Legacy view types — explicit, pinned list (Phase 5 Task 7 collapse audit).
// The `export *` scaffolding and the toProductDTO export are GONE; these exact
// names remain because the app UI/scripts still import them. Every name here
// had at least one live importer at audit time (2026-11-02). Nothing
// value-shaped leaks from this module except `internal` below.
// ---------------------------------------------------------------------------
export type {
  ActionResponse, // app action envelopes (every actions/*.ts)
  User, // profile page / lib/auth
  CreateUserInput, // actions/auth.ts
  LoginInput, // actions/auth.ts
  AuthResponse, // actions/auth.ts
  JWTPayload, // lib/auth.ts
  ProductCategory, // profile preferences UI + CategoryFilterChips
  ProductGender, // admin product form
  SizeOption, // admin product form + profile measurements
  MeasurementUnit, // profile measurements
  OrderStatus, // order/admin-order actions
  DeliveryMethod, // checkout
  ShippingAddress, // checkout
  HeroAnimationType, // hero slides admin + seed script
  HeroMobileAnimationType, // hero mobile slides
  HeroColorTheme, // hero theming
  CustomPanelStyle, // hero panel theme editor
  PromotionalCategory, // promotional-categories action (joined read shape)
} from './types'
export type {
  ProductWithVariants, // admin edit-form read + promo joined reads
  ProductFilters, // actions/products.ts
} from './repositories/product.repository'
export type { Category } from './repositories/category.repository' // ProductFormDialog category picker
export type { Color } from './repositories/color.repository' // admin ColorsClient

/**
 * @internal Narrow escape hatch for the reads with no contract home yet
 * (Phase 5 Task 7 audit). The flat `export *` layers are gone; the remaining
 * value-shaped consumers are exactly:
 *
 * - `db` — Neo4j session lifecycle (`getSession`/`closeDriver`) in the app's
 *   raw-read actions and the maintenance/seed scripts; `runQuery` in
 *   lib/schema.ts (db:init).
 * - `neo4jUtils.convertNeo4jIntegers` — the raw-Cypher admin reads in
 *   categories.ts (getCategoryProductsAction/getUnassignedProductsAction).
 * - `repositories.productRepository` — `getProductCount` (admin dashboard),
 *   `getProductById` (admin edit-form read: repository-boundary MAJOR-unit
 *   prices the form still works in — retype is a future contract decision),
 *   `createProduct` (add-products script).
 * - `repositories.categoryRepository` — `findDuplicateNames` /
 *   `getCategoryStatistics` / `getCategoriesForProduct` /
 *   `validateLeafCategoryForProduct` (categories.ts reads + bulk-assign
 *   pre-validation), `getLeafCategories` / `assignProductToCategories` /
 *   `createCategory` / `getCategoryTree` (maintenance scripts).
 * - `repositories.userRepository` — `findUserById` (profile page full-user
 *   read), `updateUser` / `findUserByEmail` (app-side admin role actions).
 *   db:seed no longer consumes this repository — it creates its users
 *   through `account.signUp` (`createUser` currently has no consumers).
 * - `repositories.heroSlideRepository` — `getAllHeroSlides` /
 *   `createHeroSlide` (hero-slide seed script).
 * - `repositories.promotionalCategoryRepository` —
 *   `getCategoryItemsWithDetails` / `getProductCategories` (promo admin
 *   joined reads with no DTO home).
 *
 * New code must go through the contract services (`createEngine`) instead.
 */
export const internal = { repositories, db, neo4jUtils }
