import type { v1 } from '@softx/contract'

/** Money → major-unit number, for rendering exactly where the old number was rendered. */
export function amount(m: v1.Money): number {
  return m.amountMinor / 100
}

/** Money → "LKR 24.99" style string using the currency code. */
export function formatPrice(m: v1.Money): string {
  return `${m.currency} ${amount(m).toFixed(2)}`
}

/**
 * Cart-domain retail total (major units) over the CartService projection.
 */
export function cartRetailTotal(items: v1.CartItemDTO[]): number {
  return items.reduce((sum, item) => sum + amount(item.product.price.retail) * item.quantity, 0)
}
