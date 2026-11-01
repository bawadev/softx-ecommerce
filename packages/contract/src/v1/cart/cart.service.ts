import type { Result } from '../core/result'
import type { CartOwner, CartMutation, CartDTO } from './cart.dto'

export interface CartService {
  /** Full cart for the owner. For guests: heals the line list (drops vanished variants) — persist guestItems. */
  getCart(owner: CartOwner): Promise<Result<CartMutation>>
  /** Add quantity of a variant (increments when the line exists). Unknown variant → NOT_FOUND. */
  addItem(owner: CartOwner, variantId: string, quantity?: number): Promise<Result<CartMutation>>
  /** Set a line's quantity (must be ≥ 1; removing is removeItem). Unknown variant → NOT_FOUND. */
  updateItem(owner: CartOwner, variantId: string, quantity: number): Promise<Result<CartMutation>>
  removeItem(owner: CartOwner, variantId: string): Promise<Result<CartMutation>>
  clearCart(owner: CartOwner): Promise<Result<CartMutation>>
}
