import { describe, it, expect } from 'vitest'
import { CartDTOSchema, GuestCartLineSchema, CartOwnerSchema } from './cart.dto'
import { money } from '../core/money'

const validCart = {
  items: [
    {
      variantId: 'v1',
      quantity: 2,
      product: {
        id: 'p1', name: 'Tee', brand: 'Acme', sku: 'S1',
        images: ['http://x/1.webp'],
        price: { stock: money(249900, 'LKR'), retail: money(299900, 'LKR') },
      },
      variant: { id: 'v1', size: 'M', color: 'Black', stockQuantity: 5 },
    },
  ],
  itemCount: 2,
  total: money(499800, 'LKR'),
}

describe('cart DTOs', () => {
  it('accepts a valid CartDTO', () => {
    expect(CartDTOSchema.safeParse(validCart).success).toBe(true)
  })

  it('rejects zero/negative guest line quantity', () => {
    expect(GuestCartLineSchema.safeParse({ variantId: 'v1', quantity: 0 }).success).toBe(false)
  })

  it('parses both CartOwner kinds', () => {
    expect(CartOwnerSchema.safeParse({ kind: 'user', userId: 'u1' }).success).toBe(true)
    expect(CartOwnerSchema.safeParse({ kind: 'guest', items: [{ variantId: 'v1', quantity: 1 }] }).success).toBe(true)
    expect(CartOwnerSchema.safeParse({ kind: 'guest' }).success).toBe(false)
  })

  it('strips deprecated fields on parse (category never survives into a CartDTO)', () => {
    const bad = JSON.parse(JSON.stringify(validCart))
    bad.items[0].product.category = 'SHIRT'
    const parsed = CartDTOSchema.parse(bad)
    expect((parsed.items[0].product as Record<string, unknown>).category).toBeUndefined()
  })
})
