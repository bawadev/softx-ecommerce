import { describe, it, expect } from 'vitest'
import { clampLineQuantity, stockOfVariant } from './cart'

// LKD-46: the add-to-cart cap — the resulting cart line can never exceed the
// variant's live stockQuantity. Pure function, no Neo4j needed.
describe('clampLineQuantity', () => {
  it('adds normally well below stock', () => {
    expect(clampLineQuantity(0, 1, 4)).toBe(1)
    expect(clampLineQuantity(2, 1, 4)).toBe(3)
  })
  it('caps the line at stock (repeated Add to Cart clicks)', () => {
    expect(clampLineQuantity(3, 1, 4)).toBe(4)
    expect(clampLineQuantity(4, 1, 4)).toBe(4)
    expect(clampLineQuantity(6, 1, 4)).toBe(4)
  })
  it('yields 0 for zero/negative stock — nothing addable', () => {
    expect(clampLineQuantity(0, 1, 0)).toBe(0)
    expect(clampLineQuantity(0, 3, -2)).toBe(0)
  })
})

// LKD-46: raw Neo4j Integer stockQuantity (e.g. { low: 4, high: 0 }) must
// normalize to a plain number; anything unreadable counts as 0.
describe('stockOfVariant', () => {
  it('passes plain numbers through', () => {
    expect(stockOfVariant({ stockQuantity: 4 })).toBe(4)
  })
  it('normalizes Neo4j Integer-shaped values', () => {
    expect(stockOfVariant({ stockQuantity: { low: 7, high: 0 } })).toBe(7)
  })
  it('treats missing/garbage stock as 0', () => {
    expect(stockOfVariant({})).toBe(0)
    expect(stockOfVariant({ stockQuantity: null })).toBe(0)
  })
})
