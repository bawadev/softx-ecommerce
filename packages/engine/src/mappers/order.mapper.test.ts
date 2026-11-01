import { describe, it, expect } from 'vitest'
import { v1 } from '@softx/contract'
import { toOrderDTO } from './order.mapper'

// Real OrderWithItems shape (order.repository): items carry the repo-only
// id/orderId plus hydrated product {id,name,brand,sku,images} and variant
// {id,productId,size,color,stockQuantity,images} via JOIN. Prices and the
// order total are MAJOR units in the repo world.
const repoOrder = {
  id: 'o1', orderNumber: 'ORD-1', userId: 'u1', status: 'PENDING', totalAmount: 2508.99,
  shippingAddress: { fullName: 'A B', addressLine1: '1 St', city: 'C', state: 'S', postalCode: 'P', country: 'LK', phone: 'T' },
  deliveryMethod: 'SHIP', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
  items: [{
    id: 'oi1', orderId: 'o1', variantId: 'v1', quantity: 2, priceAtPurchase: 2499,
    product: { id: 'p1', name: 'Tee', brand: 'Acme', sku: 'S1', images: ['http://x/product.webp'] },
    variant: { id: 'v1', productId: 'p1', size: 'M', color: 'Black', stockQuantity: 5, images: ['http://x/variant.webp'] },
  }],
}

describe('toOrderDTO', () => {
  it('maps money to minor units and parses against the contract schema', () => {
    const dto = toOrderDTO(repoOrder as never, 'LKR')
    expect(dto.totalAmount).toEqual({ amountMinor: 250899, currency: 'LKR' })
    expect(dto.items[0].priceAtPurchase).toEqual({ amountMinor: 249900, currency: 'LKR' })
    expect(() => v1.OrderSchema.parse(dto)).not.toThrow()
    expect(dto).not.toHaveProperty('userId') // ownership stays server-side, never in the DTO
    // Item drops the repo-only fields; name/image come from the hydrated JOIN
    expect(dto.items[0]).not.toHaveProperty('id')
    expect(dto.items[0]).not.toHaveProperty('orderId')
    expect(dto.items[0]).not.toHaveProperty('product')
    expect(dto.items[0]).not.toHaveProperty('variant')
    expect(dto.items[0].productName).toBe('Tee')
    expect(dto.items[0].productImage).toBe('http://x/variant.webp') // variant.images[0] || product.images[0]
  })

  it('falls back to product.images[0] when the variant has no images', () => {
    const noVariantImages = {
      ...repoOrder,
      items: [{
        ...repoOrder.items[0],
        variant: { ...repoOrder.items[0].variant, images: [] as string[] },
      }],
    }
    const dto = toOrderDTO(noVariantImages as never, 'LKR')
    expect(dto.items[0].productImage).toBe('http://x/product.webp')
  })
})
