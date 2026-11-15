import { describe, it, expect } from 'vitest'
import { computeShippingMinor, findStockShortfall } from './order'

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

// LKD-46: checkout-time stock backstop — a line exceeding live stock blocks
// the order. Pure function, no Neo4j needed.
describe('findStockShortfall', () => {
  const lines = [
    { variantId: 'v1', quantity: 2, productName: 'Tee' },
    { variantId: 'v2', quantity: 6, productName: 'QA Probe' },
  ]
  it('returns null when every line fits the live stock', () => {
    expect(findStockShortfall(lines, (id) => (id === 'v1' ? 2 : 10))).toBeNull()
  })
  it('flags the first over-stock line with its available quantity', () => {
    expect(findStockShortfall(lines, (id) => (id === 'v1' ? 1 : 10))).toEqual({
      variantId: 'v1',
      productName: 'Tee',
      available: 1,
    })
    expect(findStockShortfall(lines, () => 4)).toEqual({
      variantId: 'v2',
      productName: 'QA Probe',
      available: 4,
    })
  })
  it('treats an unresolvable variant as zero stock (no phantom selling)', () => {
    expect(findStockShortfall([lines[0]], () => undefined)).toEqual({
      variantId: 'v1',
      productName: 'Tee',
      available: 0,
    })
  })
})
