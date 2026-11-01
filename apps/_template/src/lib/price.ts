import type { v1 } from '@softx/contract'

/** Money → major-unit number (2499 minor, LKR → 24.99). */
export function amount(m: v1.Money): number {
  return m.amountMinor / 100
}

/** Money → "LKR 24.99" using the currency code. */
export function formatPrice(m: v1.Money): string {
  return `${m.currency} ${amount(m).toFixed(2)}`
}
