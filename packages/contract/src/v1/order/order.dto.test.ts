import { describe, it, expect } from 'vitest'
import { OrderSchema, CreateOrderCommandSchema } from './order.dto'
import { money } from '../core/money'

const validOrder = {
  id: 'o1', orderNumber: 'ORD-123', status: 'PENDING',
  totalAmount: money(509990, 'LKR'),
  shippingAddress: {
    fullName: 'A B', addressLine1: '1 St', city: 'Colombo', state: 'WP',
    postalCode: '00100', country: 'Sri Lanka', phone: '+94770000000',
  },
  deliveryMethod: 'SHIP' as const,
  items: [{ variantId: 'v1', quantity: 2, priceAtPurchase: money(249900, 'LKR'), productName: 'Tee', productId: 'p1', productBrand: 'Acme', variantSize: 'M', variantColor: 'Black' }],
  createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
}

describe('order DTOs', () => {
  it('accepts a valid order', () => expect(OrderSchema.safeParse(validOrder).success).toBe(true))
  it('rejects a bad status', () => {
    const bad = { ...validOrder, status: 'SHIPPED' }
    expect(OrderSchema.safeParse(bad).success).toBe(false)
  })
  it('rejects COLLECT order missing optional line2 but keeps it optional', () => {
    const cmd = CreateOrderCommandSchema.safeParse({
      shippingAddress: validOrder.shippingAddress, deliveryMethod: 'COLLECT',
    })
    expect(cmd.success).toBe(true)
  })
  it('rejects command with bad deliveryMethod', () => {
    const bad = CreateOrderCommandSchema.safeParse({
      shippingAddress: validOrder.shippingAddress, deliveryMethod: 'DRONE',
    })
    expect(bad.success).toBe(false)
  })
})
