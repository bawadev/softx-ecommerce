import { describe, it, expect } from 'vitest'
import { computeShippingMinor } from './order'

// Parity with apps/factorybay/src/app/actions/order.ts:50:
//   shipping = deliveryMethod === 'SHIP' ? (subtotal >= 100 ? 0 : 9.99) : 0
// computed in exact minor units. The order conformance suite cannot reach
// the paid-shipping branch (every catalog-world variant costs >= 100.00),
// so both sides of the threshold are pinned here, hermetically.
describe('computeShippingMinor', () => {
  it('SHIP: 99.99 subtotal charges 9.99; 100.00 ships free; COLLECT is always free', () => {
    expect(computeShippingMinor('SHIP', 9999)).toBe(999) // 99.99 → 9.99
    expect(computeShippingMinor('SHIP', 10000)).toBe(0) // 100.00 → free
    expect(computeShippingMinor('COLLECT', 9999)).toBe(0)
    expect(computeShippingMinor('COLLECT', 10000)).toBe(0)
  })
})
