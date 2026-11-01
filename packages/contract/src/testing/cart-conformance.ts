import { describe, it, expect } from 'vitest'
import * as v1 from '../v1'

export function runCartConformance(
  suiteName: string,
  makeService: () => v1.CatalogService & v1.CartService,
) {
  describe(`${suiteName}: CartService v1 conformance`, () => {
    const guest = (items: v1.GuestCartLine[] = []): v1.CartOwner => ({ kind: 'guest', items })
    const user: v1.CartOwner = { kind: 'user', userId: 'conformance-cart-user' }

    it('empty guest cart → empty CartDTO with zero total', async () => {
      const r = await makeService().getCart(guest())
      expect(r.ok).toBe(true)
      if (!r.ok) return
      expect(r.data.cart.items).toEqual([])
      expect(r.data.cart.itemCount).toBe(0)
      expect(r.data.cart.total).toEqual({ amountMinor: 0, currency: 'LKR' })
      expect(r.data.guestItems).toEqual([])
    })

    it('guest addItem adds and increments; total is stock × qty in minor units', async () => {
      const s = makeService()
      const a = await s.addItem(guest(), 'conformance-v1', 2)
      expect(a.ok).toBe(true)
      if (!a.ok) return
      expect(a.data.cart.itemCount).toBe(2)
      expect(a.data.cart.total).toEqual({ amountMinor: 499800, currency: 'LKR' }) // 2 × 2499.00
      expect(a.data.guestItems).toEqual([{ variantId: 'conformance-v1', quantity: 2 }])

      const b = await s.addItem(guest(a.data.guestItems!), 'conformance-v1', 1)
      expect(b.ok && b.data.cart.itemCount).toBe(3)
      expect(b.ok && b.data.guestItems).toEqual([{ variantId: 'conformance-v1', quantity: 3 }])
    })

    it('guest updateItem / removeItem / clearCart', async () => {
      const s = makeService()
      const start = guest([{ variantId: 'conformance-v1', quantity: 3 }])
      const u = await s.updateItem(start, 'conformance-v1', 1)
      expect(u.ok && u.data.cart.itemCount).toBe(1)
      const rm = await s.removeItem(u.ok ? guest(u.data.guestItems!) : start, 'conformance-v1')
      expect(rm.ok && rm.data.cart.items).toEqual([])
      const cl = await s.clearCart(guest([{ variantId: 'conformance-v3', quantity: 1 }]))
      expect(cl.ok && cl.data.guestItems).toEqual([])
    })

    it('guest addItem unknown variant → NOT_FOUND; quantity 0 → VALIDATION', async () => {
      const s = makeService()
      const nf = await s.addItem(guest(), 'no-such-variant', 1)
      expect(nf.ok).toBe(false)
      if (!nf.ok) expect(nf.error.code).toBe('NOT_FOUND')
      const v = await s.addItem(guest(), 'conformance-v1', 0)
      expect(v.ok).toBe(false)
      if (!v.ok) expect(v.error.code).toBe('VALIDATION')
    })

    it('guest getCart heals lines whose variant vanished', async () => {
      const s = makeService()
      const r = await s.getCart(guest([
        { variantId: 'conformance-v1', quantity: 1 },
        { variantId: 'vanished-variant', quantity: 4 },
      ]))
      expect(r.ok).toBe(true)
      if (!r.ok) return
      expect(r.data.cart.itemCount).toBe(1)
      expect(r.data.guestItems).toEqual([{ variantId: 'conformance-v1', quantity: 1 }])
    })

    it('user cart reads the seeded line; mutations persist per-call', async () => {
      const s = makeService()
      const g = await s.getCart(user)
      expect(g.ok && g.data.cart.itemCount).toBe(2)
      const a = await s.addItem(user, 'conformance-v3', 1)
      expect(a.ok && a.data.cart.itemCount).toBe(3) // seeded 2 + new 1
      expect(a.ok && a.data.guestItems).toBeUndefined()
      const u = await s.updateItem(user, 'conformance-v3', 2)
      expect(u.ok && u.data.cart.itemCount).toBe(4) // 2 + 2
      const rm = await s.removeItem(user, 'conformance-v3')
      expect(rm.ok && rm.data.cart.itemCount).toBe(2)
      // restore the seeded state for repeatability
      await s.clearCart(user)
      await s.addItem(user, 'conformance-v1', 2)
    })

    it('guest updateItem on a vanished-variant line heals it away', async () => {
      const s = makeService()
      const r = await s.updateItem(
        guest([{ variantId: 'vanished-variant', quantity: 2 }]),
        'vanished-variant',
        3,
      )
      // Either NOT_FOUND (missing-line reading) or a healed empty cart is contract-valid;
      // what is NOT valid is a mutation that keeps the dead line.
      if (r.ok) {
        expect(r.data.cart.items).toEqual([])
        expect(r.data.guestItems).toEqual([])
      } else {
        expect(r.error.code).toBe('NOT_FOUND')
      }
    })

    it('user updateItem on a missing line → NOT_FOUND', async () => {
      const s = makeService()
      const r = await s.updateItem(user, 'no-such-variant-in-cart', 2)
      expect(r.ok).toBe(false)
      if (!r.ok) expect(r.error.code).toBe('NOT_FOUND')
    })

    it('guest updateItem round-trips the updated guestItems', async () => {
      const s = makeService()
      const u = await s.updateItem(
        guest([
          { variantId: 'conformance-v1', quantity: 2 },
          { variantId: 'conformance-v3', quantity: 1 },
        ]),
        'conformance-v1',
        5,
      )
      expect(u.ok).toBe(true)
      if (!u.ok) return
      expect(u.data.guestItems).toContainEqual({ variantId: 'conformance-v1', quantity: 5 })
      expect(u.data.guestItems).toContainEqual({ variantId: 'conformance-v3', quantity: 1 })
      expect(u.data.cart.itemCount).toBe(6)
    })
  })
}
