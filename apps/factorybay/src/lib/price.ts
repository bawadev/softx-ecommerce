import type { v1 } from '@softx/contract'
import type { CartItemWithDetails } from '@softx/engine'

/** Money → major-unit number, for rendering exactly where the old number was rendered. */
export function amount(m: v1.Money): number {
  return m.amountMinor / 100
}

/** Money → "LKR 24.99" style string using the currency code. */
export function formatPrice(m: v1.Money): string {
  return `${m.currency} ${amount(m).toFixed(2)}`
}

/**
 * Cart-domain retail total (major-unit prices from the cart repository join).
 * The cart is not on the engine path yet (Phase 2 migrates it to Money); this
 * keeps that arithmetic in one place instead of the UI component.
 */
export function cartRetailTotal(items: CartItemWithDetails[]): number {
  return items.reduce((sum, item) => sum + item.product.retailPrice * item.quantity, 0)
}
