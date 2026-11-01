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
    // Flat display fields (product link target, brand line, variant attributes)
    expect(dto.items[0].productId).toBe('p1')
    expect(dto.items[0].productBrand).toBe('Acme')
    expect(dto.items[0].variantSize).toBe('M')
    expect(dto.items[0].variantColor).toBe('Black')
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

  it('maps a severed variant/product link to placeholder display fields without throwing', () => {
    // Admin deleteVariant/deleteProduct DETACH DELETE the variant/product
    // nodes, so the repo's OPTIONAL MATCH over ITEM_OF_VARIANT→VARIANT_OF
    // yields product:null/variant:null while the OrderItem node (and its
    // variantId/quantity/priceAtPurchase) still exists.
    const severed = {
      ...repoOrder,
      items: [{
        id: 'oi1', orderId: 'o1', variantId: 'v1', quantity: 2, priceAtPurchase: 2499,
        product: null,
        variant: null,
      }],
    }
    const dto = toOrderDTO(severed as never, 'LKR')
    const item = dto.items[0]
    // OrderItem-node properties survive the severed JOIN
    expect(item.variantId).toBe('v1')
    expect(item.quantity).toBe(2)
    expect(item.priceAtPurchase).toEqual({ amountMinor: 249900, currency: 'LKR' })
    // Placeholder display fields instead of a throw — every field PRESENT
    // ('' placeholders), only productImage (always optional) stays omitted
    expect(item.productName).toBe('(unavailable)')
    expect(item.productId).toBe('')
    expect(item.productBrand).toBe('')
    expect(item.variantSize).toBe('')
    expect(item.variantColor).toBe('')
    expect(item).not.toHaveProperty('productImage')
    // One severed item must never fail the whole orders list (listOrders
    // try/catch) — the DTO still satisfies the contract schema, which keeps
    // all four display fields required (variantSize is a plain string so ''
    // parses).
    expect(() => v1.OrderSchema.parse(dto)).not.toThrow()
  })
})
