import type { Result } from '../core/result'
import type { ProductDTO } from '../catalog/product.dto'
import type {
  AccountDTO,
  SignUpCommand,
  Credentials,
  UserPreferencesDTO,
  UserMeasurementsDTO,
} from './account.dto'

export interface AccountService {
  /**
   * Creates an account (server-side hashing; the hash never leaves the engine).
   * Duplicate email → CONFLICT; invalid email/password shape → VALIDATION with
   * the app's parity messages; `role` defaults to CUSTOMER (engine-enforced).
   */
  signUp(command: SignUpCommand): Promise<Result<AccountDTO>>
  /** Unknown email or wrong password → UNAUTHORIZED. Returns the account, never a password hash. */
  authenticate(credentials: Credentials): Promise<Result<AccountDTO>>
  /** Unknown id → NOT_FOUND. */
  getProfile(userId: string): Promise<Result<AccountDTO>>
}

export interface ProfileService {
  /** Preferences read; unset preferences are materialized as the default (empty) shape, not NOT_FOUND. */
  getPreferences(userId: string): Promise<Result<UserPreferencesDTO>>
  /** Upsert (per-user singleton); invalid shape → VALIDATION. */
  updatePreferences(userId: string, preferences: UserPreferencesDTO): Promise<Result<UserPreferencesDTO>>
  /** Measurements read; unset measurements are materialized as the default shape (unit METRIC), not NOT_FOUND. */
  getMeasurements(userId: string): Promise<Result<UserMeasurementsDTO>>
  /** Upsert (per-user singleton); invalid shape → VALIDATION. */
  updateMeasurements(userId: string, measurements: UserMeasurementsDTO): Promise<Result<UserMeasurementsDTO>>
  /** Records a browsing-history entry for recommendation inputs. */
  trackProductView(userId: string, productId: string): Promise<Result<null>>
  /** Newest-first browsing history as catalog DTOs; a user with no history → empty array. */
  listRecentlyViewed(userId: string, limit?: number): Promise<Result<ProductDTO[]>>
  /** Personalized recommendations from preferences/history; may legitimately be empty. */
  listRecommendations(userId: string, limit?: number): Promise<Result<ProductDTO[]>>
  /** Same-filter alternatives for a product; may legitimately be empty. */
  listSimilarProducts(productId: string, limit?: number): Promise<Result<ProductDTO[]>>
}
