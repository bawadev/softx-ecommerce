import { describe, it, expect } from 'vitest'
import { toProductDTO } from './catalog.mapper'

const repoProduct = {
  id: 'p1', name: 'Tee', description: 'd', brand: 'Acme', gender: 'UNISEX',
  stockPrice: 2499.99, retailPrice: 2999, sku: 'S1',
  images: ['http://x/1.webp'],
  createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
  variants: [{ id: 'v1', productId: 'p1', size: 'M', color: 'Black', stockQuantity: 5, images: ['old'] }],
}

describe('toProductDTO', () => {
  it('maps prices to Money in minor units', () => {
    const dto = toProductDTO(repoProduct as never, 'LKR')
    expect(dto.price.stock).toEqual({ amountMinor: 249999, currency: 'LKR' })
    expect(dto.price.retail).toEqual({ amountMinor: 299900, currency: 'LKR' })
  })

  it('drops deprecated fields (category, variant images)', () => {
    const dto = toProductDTO({ ...repoProduct, category: 'SHIRT' } as never, 'LKR')
    expect(dto).not.toHaveProperty('category')
    expect(dto.variants[0]).not.toHaveProperty('images')
    expect(dto.variants[0]).not.toHaveProperty('productId')
  })
})
