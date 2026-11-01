import { describe, it, expect } from 'vitest'
import { toCartItemDTO, cartTotal } from './cart.mapper'

const repoItem = {
  id: 'c1', userId: 'u1', variantId: 'v1', quantity: 2, addedAt: '2026-01-01T00:00:00.000Z',
  product: { id: 'p1', name: 'Tee', brand: 'Acme', category: 'SHIRT', gender: 'UNISEX',
             stockPrice: 2499, retailPrice: 2999, sku: 'S1', images: ['http://x/1.webp'] },
  variant: { id: 'v1', productId: 'p1', size: 'M', color: 'Black', stockQuantity: 5, images: ['old'] },
}

describe('cart mappers', () => {
  it('maps to CartItemDTO with Money prices and no deprecated fields', () => {
    const dto = toCartItemDTO(repoItem as never, 'LKR')
    expect(dto.product.price.stock).toEqual({ amountMinor: 249900, currency: 'LKR' })
    expect(dto.product).not.toHaveProperty('category')
    expect(dto.variant).not.toHaveProperty('images')
    expect(dto.variant).not.toHaveProperty('productId')
  })

  it('cartTotal sums stock × qty in minor units', () => {
    const items = [toCartItemDTO(repoItem as never, 'LKR')]
    expect(cartTotal(items, 'LKR')).toEqual({ amountMinor: 499800, currency: 'LKR' })
  })
})
