import { describe, it, expect } from 'vitest'
import * as v1 from '../v1'

const address: v1.ShippingAddressDTO = {
  fullName: 'Conformance Buyer', addressLine1: '1 Test St', city: 'Colombo', state: 'WP',
  postalCode: '00100', country: 'Sri Lanka', phone: '+94770000000',
}

/**
 * Shared OrderService v1 conformance suite.
 *
 * Totals parity — apps/factorybay/src/app/actions/order.ts:50:
 *   shipping = deliveryMethod === 'SHIP' ? (subtotal >= 100 ? 0 : 9.99) : 0
 * where subtotal is Σ stockPrice(major units) × qty. Every catalog-world
 * variant costs ≥ 100.00 (cheapest is conformance-v1 at 2499.00), so with
 * SHIP the threshold branch ALWAYS resolves to free shipping here. The
 * 9.99 branch (subtotal < 100.00) is unreachable with the current world
 * fixtures; covering it would need a sub-100.00 variant.
 */
export function runOrderConformance(
  suiteName: string,
  makeService: () => v1.CatalogService & v1.CartService & v1.OrderService,
) {
  describe(`${suiteName}: OrderService v1 conformance`, () => {
    it('createOrder computes totals server-side: SHIP subtotal ≥ 100.00 ships free, then clears the cart', async () => {
      const s = makeService()
      const user = 'conformance-cart-user'
      await s.clearCart({ kind: 'user', userId: user })
      await s.addItem({ kind: 'user', userId: user }, 'conformance-v1', 1) // 2499.00
      const r = await s.createOrder(user, { shippingAddress: address, deliveryMethod: 'SHIP' })
      expect(r.ok).toBe(true)
      if (!r.ok) return
      // subtotal 2499.00 ≥ 100.00 → free shipping (parity: subtotal >= 100 ? 0 : 9.99) → 2499.00
      expect(r.data.totalAmount).toEqual({ amountMinor: 249900, currency: 'LKR' })
      expect(r.data.status).toBe('PENDING')
      expect(r.data.items[0]).toMatchObject({ variantId: 'conformance-v1', quantity: 1 })
      // cart cleared by a successful order
      const cart = await s.getCart({ kind: 'user', userId: user })
      expect(cart.ok && cart.data.cart.itemCount).toBe(0)
    })

    it('createOrder SHIP at/over 100 ships free; COLLECT never charges shipping', async () => {
      const s = makeService()
      const user = 'conformance-cart-user'
      await s.clearCart({ kind: 'user', userId: user })
      await s.addItem({ kind: 'user', userId: user }, 'conformance-v3', 1) // 4999.00
      const a = await s.createOrder(user, { shippingAddress: address, deliveryMethod: 'SHIP' })
      expect(a.ok && a.data.totalAmount).toEqual({ amountMinor: 499900, currency: 'LKR' })
      await s.addItem({ kind: 'user', userId: user }, 'conformance-v1', 1)
      const b = await s.createOrder(user, { shippingAddress: address, deliveryMethod: 'COLLECT' })
      expect(b.ok && b.data.totalAmount).toEqual({ amountMinor: 249900, currency: 'LKR' })
    })

    it('empty cart → VALIDATION', async () => {
      const s = makeService()
      const user = 'conformance-cart-user'
      await s.clearCart({ kind: 'user', userId: user })
      const r = await s.createOrder(user, { shippingAddress: address, deliveryMethod: 'SHIP' })
      expect(r.ok).toBe(false)
      if (!r.ok) expect(r.error.code).toBe('VALIDATION')
    })

    it('getOrder enforces ownership; listOrders returns the user’s orders', async () => {
      const s = makeService()
      const user = 'conformance-cart-user'
      await s.clearCart({ kind: 'user', userId: user })
      await s.addItem({ kind: 'user', userId: user }, 'conformance-v1', 1)
      const created = await s.createOrder(user, { shippingAddress: address, deliveryMethod: 'SHIP' })
      expect(created.ok).toBe(true)
      if (!created.ok) return
      const got = await s.getOrder(user, created.data.id)
      expect(got.ok && got.data.orderNumber).toBe(created.data.orderNumber)
      const stranger = await s.getOrder('someone-else', created.data.id)
      expect(stranger.ok).toBe(false)
      if (!stranger.ok) expect(stranger.error.code).toBe('UNAUTHORIZED')
      const listed = await s.listOrders(user)
      expect(listed.ok && listed.data.some((o) => o.id === created.data.id)).toBe(true)
      await s.clearCart({ kind: 'user', userId: user }) // leave world consistent
    })

    it('attachPaymentProof records the URL (owner-only)', async () => {
      const s = makeService()
      const user = 'conformance-cart-user'
      await s.clearCart({ kind: 'user', userId: user })
      await s.addItem({ kind: 'user', userId: user }, 'conformance-v1', 1)
      const created = await s.createOrder(user, { shippingAddress: address, deliveryMethod: 'COLLECT' })
      if (!created.ok) throw new Error('setup failed')
      const r = await s.attachPaymentProof(user, created.data.id, 'http://minio.test/proofs/p1.png')
      expect(r.ok && r.data.paymentProof).toBe('http://minio.test/proofs/p1.png')
      const stranger = await s.attachPaymentProof('someone-else', created.data.id, 'http://x/y.png')
      expect(stranger.ok).toBe(false)
      await s.clearCart({ kind: 'user', userId: user })
    })

    it('mergeCarts moves guest lines into the user cart, healing dead variants', async () => {
      const s = makeService()
      const user = 'conformance-cart-user'
      await s.clearCart({ kind: 'user', userId: user })
      const r = await s.mergeCarts(
        { kind: 'guest', items: [
          { variantId: 'conformance-v1', quantity: 2 },
          { variantId: 'vanished-variant', quantity: 1 },
        ] },
        user,
      )
      expect(r.ok).toBe(true)
      if (!r.ok) return
      expect(r.data.cart.itemCount).toBe(2)
      expect(r.data.guestItems).toBeUndefined() // user carts never echo guest lines
      await s.clearCart({ kind: 'user', userId: user })
    })
  })
}
