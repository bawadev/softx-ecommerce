import { z } from 'zod'
import { SizeOptionSchema } from '../catalog/product.dto'

/**
 * Account/profile contract for Phase 4. Shapes mirror the engine's real
 * repository types (`packages/engine/src/types.ts` `User`, `UserPreference`,
 * `UserMeasurements`) minus persistence fields (`id`/`userId` on the profile
 * types) and minus `passwordHash` — hashes never leave the engine.
 *
 * Email/password FORMAT rules are not duplicated here: the engine owns them
 * (Task 3 ports `apps/factorybay/src/lib/auth.ts` `isValidEmail`/
 * `validatePassword` verbatim for message parity). These schemas pin only
 * presence/shape at the contract boundary.
 */
export const UserRoleSchema = z.enum(['CUSTOMER', 'ADMIN'])
export type UserRole = z.infer<typeof UserRoleSchema>

/** Mirrors engine `User` minus passwordHash. Unknown keys (e.g. a leaked hash) are stripped on parse. */
export const AccountSchema = z.object({
  id: z.string(),
  email: z.string(),
  role: UserRoleSchema,
  firstName: z.string(),
  lastName: z.string(),
  phone: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
})
export type AccountDTO = z.infer<typeof AccountSchema>

/** Email validity and password strength (exact app parity messages) are enforced engine-side; here only non-empty shape. */
export const SignUpCommandSchema = z.object({
  email: z.string().min(1),
  password: z.string().min(1),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  phone: z.string().optional(),
  role: UserRoleSchema.optional(),
})
export type SignUpCommand = z.infer<typeof SignUpCommandSchema>

export const CredentialsSchema = z.object({
  email: z.string().min(1),
  password: z.string().min(1),
})
export type Credentials = z.infer<typeof CredentialsSchema>

/**
 * Mirrors the engine's `ProductCategory` union — the REAL type of
 * `UserPreference.preferredCategories` (verified against
 * `packages/engine/src/types.ts`; the profile UI toggles exactly these six).
 * Products themselves no longer carry a category (TAGGED_WITH filters), which
 * is why this enum lives here and not on ProductDTO.
 */
export const ProductCategorySchema = z.enum([
  'SHIRT',
  'PANTS',
  'JACKET',
  'DRESS',
  'SHOES',
  'ACCESSORIES',
])
export type ProductCategory = z.infer<typeof ProductCategorySchema>

export const PriceRangeSchema = z.object({
  min: z.number(),
  max: z.number(),
})
export type PriceRange = z.infer<typeof PriceRangeSchema>

/** Mirrors engine `UserPreference` minus `id`/`userId`. */
export const UserPreferencesSchema = z.object({
  preferredBrands: z.array(z.string()),
  preferredColors: z.array(z.string()),
  preferredCategories: z.array(ProductCategorySchema),
  priceRange: PriceRangeSchema,
})
export type UserPreferencesDTO = z.infer<typeof UserPreferencesSchema>

export const MeasurementUnitSchema = z.enum(['METRIC', 'IMPERIAL'])
export type MeasurementUnit = z.infer<typeof MeasurementUnitSchema>

/**
 * Mirrors engine `UserMeasurements` minus `id`/`userId`: seven optional body
 * metrics (centimetres/kilograms when METRIC), an optional clothing size, and
 * the REQUIRED unit the engine type carries (`MeasurementUnit`).
 */
export const UserMeasurementsSchema = z.object({
  chest: z.number().optional(),
  waist: z.number().optional(),
  hips: z.number().optional(),
  shoulders: z.number().optional(),
  inseam: z.number().optional(),
  height: z.number().optional(),
  weight: z.number().optional(),
  preferredSize: SizeOptionSchema.optional(),
  unit: MeasurementUnitSchema,
})
export type UserMeasurementsDTO = z.infer<typeof UserMeasurementsSchema>
