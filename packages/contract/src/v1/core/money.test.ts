import { describe, it, expect } from 'vitest'
import { money, fromMajorAmount } from './money'

describe('money', () => {
  it('builds from minor units', () => {
    expect(money(249000, 'LKR')).toEqual({ amountMinor: 249000, currency: 'LKR' })
  })

  it('converts major-unit floats safely', () => {
    expect(fromMajorAmount(2499, 'LKR').amountMinor).toBe(249900)
    expect(fromMajorAmount(2499.99, 'LKR').amountMinor).toBe(249999)
    expect(fromMajorAmount(0.1 + 0.2, 'LKR').amountMinor).toBe(30)
  })

  it('rejects non-integer minor units', () => {
    expect(() => money(1.5, 'LKR')).toThrow(/integer/)
  })
})
