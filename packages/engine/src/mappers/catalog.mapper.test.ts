import { describe, it, expect } from 'vitest'
import neo4j from 'neo4j-driver'
import { v1 } from '@softx/contract'
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

  it('converts Neo4j Integer variant stockQuantity to a plain number', () => {
    // Regression: the product repository returns raw driver records, so
    // integer properties arrive as Neo4j Integer objects. Without the
    // convertNeo4jIntegers normalization in toProductDTO, stockQuantity
    // stays an Integer object and ProductSchema's z.number().int()
    // rejects it (seen live in the real-engine conformance run).
    const raw = {
      ...repoProduct,
      variants: [{ ...repoProduct.variants[0], stockQuantity: neo4j.int(5) }],
    }
    const dto = toProductDTO(raw as never, 'LKR')
    expect(dto.variants[0].stockQuantity).toBe(5)
    expect(() => v1.ProductSchema.parse(dto)).not.toThrow()
  })
})
