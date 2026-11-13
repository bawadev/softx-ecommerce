import type { v1 } from '@softx/contract'

/**
 * Storefront shipping rule — the single UI source of truth (LKD-32).
 *
 * Mirrors the authoritative charge rule in packages/engine/src/order.ts
 * (computeShippingMinor): SHIP delivery is free at/above the threshold,
 * otherwise a flat fee; COLLECT is always free. The UI used to hardcode
 * these numbers independently in the cart and checkout pages; import them
 * from here instead so display can never drift from the engine's charge.
 *
 * NOTE: the flat fee's VALUE is a business decision (it reads like a
 * USD-style leftover) — changing it means changing the engine too, so the
 * fee amount intentionally lives in exactly these two mirrored places.
 */
export const FREE_SHIPPING_THRESHOLD_MAJOR = 100
export const SHIP_COST_MAJOR = 9.99

export function shippingMajor(
  deliveryMethod: v1.OrderDTO['deliveryMethod'],
  subtotalMajor: number
): number {
  if (deliveryMethod !== 'SHIP') return 0
  return subtotalMajor >= FREE_SHIPPING_THRESHOLD_MAJOR ? 0 : SHIP_COST_MAJOR
}
