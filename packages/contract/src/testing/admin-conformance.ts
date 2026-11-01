import { describe, it, expect } from 'vitest'
import * as v1 from '../v1'
import { adminWorld } from './admin-world'
import { worldCurrency } from './catalog-world'

/**
 * Shared AdminCatalogService + AdminOrderService v1 conformance suite
 * (Phase 5 Task 2). The suite is the spec: Task 3's engine and Task 4's fake
 * must satisfy it. UNWIRED by design — runners wire it (fake-admin in
 * engine-fixtures, real engine in packages/engine/test).
 *
 * Runner shape: the admin CRUD round-trips need the storefront trio too —
 * the order block checks out as the CART world's user via createOrder, and
 * several blocks verify admin writes through storefront reads (getProduct,
 * getCategory, getPromotionalCategoryBySlug, listHeroSlides, getOrder,
 * listNewArrivals). Hence the intersection type on makeService.
 *
 * Unit discipline (pinned in admin.service.ts): admin WRITE inputs carry
 * prices as MAJOR-unit numbers (form/repo boundary); storefront read DTOs
 * carry Money (minor units). The product round-trip pins the conversion:
 * stockPrice 1234 in → { amountMinor: 123400 } out.
 *
 * Cleanup discipline: every block deletes what it created through the admin
 * surface, so the suite is order-independent and DB-friendly. The single
 * exception is ORDERS — the contract has no deleteOrder, so the order block
 * restores the seeded cart lines and leaves the order row to runner-side
 * teardown (same arrangement as runOrderConformance).
 *
 * Gating discipline: the actor check is engine-side and GUARD-FIRST — a
 * non-admin actor against an UNKNOWN id must answer UNAUTHORIZED, not
 * NOT_FOUND (pinned in the first two blocks). The documented parity message
 * 'Admin access required' is pinned once.
 */
export function runAdminConformance(
  suiteName: string,
  makeService: () => v1.AdminCatalogService & v1.AdminOrderService & v1.CatalogService & v1.OrderService & v1.CartService,
) {
  describe(`${suiteName}: AdminCatalogService + AdminOrderService v1 conformance`, () => {
    const admin = adminWorld.actor
    const anonymous: v1.ActorRef = { kind: 'anonymous' }
    // customer actor over the cart world's seeded user (node exists when the
    // runner seeds cartWorld; the guard checks kind, not the DB)
    const customer: v1.ActorRef = { kind: 'customer', userId: 'conformance-cart-user' }
    const cartUser = { kind: 'user', userId: 'conformance-cart-user' } as const

    const address: v1.ShippingAddressDTO = {
      fullName: 'Conformance Buyer', addressLine1: '1 Test St', city: 'Colombo', state: 'WP',
      postalCode: '00100', country: 'Sri Lanka', phone: '+94770000000',
    }

    /** Asserts a Result failed with UNAUTHORIZED, echoing the label on failure. */
    const expectUnauthorized = async (label: string, call: () => Promise<v1.Result<unknown>>) => {
      const r = await call()
      expect({ label, ok: r.ok, code: r.ok ? undefined : r.error.code })
        .toEqual({ label, ok: false, code: 'UNAUTHORIZED' })
    }

    /** Minimal valid product-create payload (gating blocks never reach validation). */
    const productCreate = (name: string): v1.ProductCreateInput => ({
      name,
      description: 'admin conformance fixture',
      brand: 'AdminBrand',
      gender: 'UNISEX',
      stockPrice: 100,
      retailPrice: 120,
      sku: 'CONF-ADMIN-GATE',
      images: [],
      variants: [{ size: 'M', color: 'Black', stockQuantity: 1 }],
    })

    /** Minimal valid hero-slide create payload. */
    const heroCreate = (displayOrder: number): v1.HeroSlideWriteInput => ({
      imageUrl: 'http://minio.test/hero/admin-gate.webp',
      animationType: 'left-panel',
      colorTheme: 'light',
      badgeText: 'Admin',
      title: 'Conformance Admin Hero',
      subtitle: 'gate',
      displayOrder,
    })

    it('rejects anonymous actors on every admin surface (guard precedes any lookup)', async () => {
      const s = makeService()
      // unknown ids: the actor guard must fire BEFORE any repository lookup —
      // UNAUTHORIZED, not NOT_FOUND
      await expectUnauthorized('deleteProduct', () => s.deleteProduct(anonymous, 'does-not-exist'))
      await expectUnauthorized('updateOrderStatus', () => s.updateOrderStatus(anonymous, 'does-not-exist', 'CONFIRMED'))
      await expectUnauthorized('createProduct', () => s.createProduct(anonymous, productCreate('Anon Product')))
      await expectUnauthorized('createCategory', () => s.createCategory(anonymous, { name: 'Anon Cat', hierarchy: 'conformance-admin' }))
      await expectUnauthorized('createPromotionalCategory', () => s.createPromotionalCategory(anonymous, { name: 'Anon Promo', slug: 'conformance-anon-promo', displayOrder: 99 }))
      await expectUnauthorized('createHeroSlide', () => s.createHeroSlide(anonymous, heroCreate(98)))
      await expectUnauthorized('createColor', () => s.createColor(anonymous, 'Anon Blue', '#0000ff'))
      await expectUnauthorized('listAllOrders', () => s.listAllOrders(anonymous))
      // message pinned once — the documented parity string (Phase 5 constraints)
      const pinned = await s.listColors(anonymous)
      expect(pinned.ok).toBe(false)
      if (!pinned.ok) expect(pinned.error.message).toBe('Admin access required')
    })

    it('rejects customer actors on every admin surface (reads included)', async () => {
      const s = makeService()
      await expectUnauthorized('updateProduct', () => s.updateProduct(customer, 'does-not-exist', { name: 'Nope' }))
      await expectUnauthorized('deleteCategory', () => s.deleteCategory(customer, 'does-not-exist'))
      await expectUnauthorized('addProductToPromotionalCategory', () => s.addProductToPromotionalCategory(customer, 'does-not-exist', 'conformance-p1', 1))
      await expectUnauthorized('reorderHeroSlides', () => s.reorderHeroSlides(customer, []))
      await expectUnauthorized('toggleColorActive', () => s.toggleColorActive(customer, 'does-not-exist'))
      await expectUnauthorized('listColors', () => s.listColors(customer))
      await expectUnauthorized('colorCount', () => s.colorCount(customer))
      await expectUnauthorized('listAllOrders', () => s.listAllOrders(customer))
      await expectUnauthorized('updateOrderStatus', () => s.updateOrderStatus(customer, 'does-not-exist', 'CONFIRMED'))
    })

    it('product round-trip: create (major-unit prices → Money) → storefront read → partial update → delete', async () => {
      const s = makeService()
      const created = await s.createProduct(admin, {
        name: 'Conformance Admin Tee',
        description: 'created by the admin conformance suite',
        brand: 'AdminBrand',
        gender: 'UNISEX',
        stockPrice: 1234, // MAJOR units — write-input discipline
        retailPrice: 1567,
        sku: 'CONF-ADMIN-TEE',
        images: ['http://minio.test/product-images/admin-tee.webp'],
        variants: [{ size: 'M', color: 'Black', stockQuantity: 3 }],
      })
      expect(created.ok).toBe(true)
      if (!created.ok) return
      expect(() => v1.ProductSchema.parse(created.data)).not.toThrow()
      // major write units surface as Money (minor) on the storefront DTO
      expect(created.data.price).toEqual({
        stock: { amountMinor: 123400, currency: worldCurrency },
        retail: { amountMinor: 156700, currency: worldCurrency },
      })
      expect(created.data.sku).toBe('CONF-ADMIN-TEE')
      expect(created.data.variants).toHaveLength(1)
      expect(created.data.variants[0]).toMatchObject({ size: 'M', color: 'Black', stockQuantity: 3 })

      // visible through the storefront read surface
      const seen = await s.getProduct(created.data.id)
      expect(seen.ok && seen.data.name).toBe('Conformance Admin Tee')

      // partial update: named fields change, untouched fields survive
      const updated = await s.updateProduct(admin, created.data.id, { name: 'Conformance Admin Tee v2', retailPrice: 1600 })
      expect(updated.ok && updated.data.name).toBe('Conformance Admin Tee v2')
      expect(updated.ok && updated.data.price.retail).toEqual({ amountMinor: 160000, currency: worldCurrency })
      expect(updated.ok && updated.data.sku).toBe('CONF-ADMIN-TEE')

      // delete → gone from the storefront
      expect((await s.deleteProduct(admin, created.data.id)).ok).toBe(true)
      const gone = await s.getProduct(created.data.id)
      expect(gone.ok).toBe(false)
      if (!gone.ok) expect(gone.error.code).toBe('NOT_FOUND')
    })

    it('product helpers: addVariant → updateVariant → image add/remove → searchProductsByName → checkProductNameExists', async () => {
      const s = makeService()
      const created = await s.createProduct(admin, {
        name: 'Conformance Admin Hoodie',
        description: 'created by the admin conformance suite',
        brand: 'AdminBrand',
        gender: 'MEN',
        stockPrice: 2500,
        retailPrice: 2900,
        sku: 'CONF-ADMIN-HOODIE',
        images: ['http://minio.test/product-images/admin-hoodie.webp'],
        variants: [{ size: 'L', color: 'Grey', stockQuantity: 1 }],
      })
      if (!created.ok) throw new Error('setup failed')
      const id = created.data.id

      const withVariant = await s.addVariant(admin, id, { size: 'XL', color: 'Blue', stockQuantity: 2 })
      expect(withVariant.ok).toBe(true)
      if (!withVariant.ok) return
      expect(withVariant.data.variants).toHaveLength(2)
      const added = withVariant.data.variants.find((v) => v.size === 'XL' && v.color === 'Blue')
      expect(added).toBeDefined()

      const tweaked = await s.updateVariant(admin, added!.id, { stockQuantity: 7 })
      expect(tweaked.ok).toBe(true)
      if (!tweaked.ok) return
      expect(tweaked.data.variants.find((v) => v.id === added!.id)?.stockQuantity).toBe(7)

      const secondImage = 'http://minio.test/product-images/admin-hoodie-2.webp'
      const withImage = await s.addProductImage(admin, id, secondImage)
      expect(withImage.ok && withImage.data.images).toContain(secondImage)
      const withoutImage = await s.removeProductImage(admin, id, secondImage)
      expect(withoutImage.ok && withoutImage.data.images).not.toContain(secondImage)

      const found = await s.searchProductsByName(admin, 'Conformance Admin Hoodie')
      expect(found.ok && found.data.some((p) => p.id === id)).toBe(true)

      // name-uniqueness probe used by the update form: hit for the bare name,
      // miss once the product itself is excluded
      const exists = await s.checkProductNameExists(admin, 'Conformance Admin Hoodie')
      expect(exists.ok && exists.data).toBe(true)
      const excludingSelf = await s.checkProductNameExists(admin, 'Conformance Admin Hoodie', id)
      expect(excludingSelf.ok && excludingSelf.data).toBe(false)

      expect((await s.deleteProduct(admin, id)).ok).toBe(true) // cleanup
    })

    it('category round-trip: create root + child → assign (single + bulk) → move → update → delete', async () => {
      const s = makeService()
      const root = await s.createCategory(admin, { name: 'Conformance Admin Root', hierarchy: 'conformance-admin' })
      expect(root.ok).toBe(true)
      if (!root.ok) return
      expect(() => v1.CategorySchema.parse(root.data)).not.toThrow()
      expect(root.data.slug.length).toBeGreaterThan(0) // slug is generated repo-side — presence, not format
      expect(root.data.parentId).toBeNull()
      expect(root.data.isActive).toBe(true)

      const child = await s.createCategory(admin, { name: 'Conformance Admin Child', hierarchy: 'conformance-admin', parentId: root.data.id })
      expect(child.ok).toBe(true)
      if (!child.ok) return
      expect(child.data.parentId).toBe(root.data.id)
      const childId = child.data.id

      // product assignment against the WORLD product (removed before delete — world restored)
      expect((await s.assignProductToCategory(admin, 'conformance-p1', childId)).ok).toBe(true)
      expect((await s.removeProductFromCategory(admin, 'conformance-p1', childId)).ok).toBe(true)
      expect((await s.assignProductToCategories(admin, 'conformance-p1', [root.data.id])).ok).toBe(true)
      expect((await s.removeProductFromCategory(admin, 'conformance-p1', root.data.id)).ok).toBe(true)

      // move the child out from under the root, then partial update on the root
      const moved = await s.moveCategory(admin, childId, null)
      expect(moved.ok && moved.data.parentId).toBeNull()
      const updated = await s.updateCategory(admin, root.data.id, { name: 'Conformance Admin Root v2', isFeatured: true })
      expect(updated.ok && updated.data.name).toBe('Conformance Admin Root v2')
      expect(updated.ok && updated.data.isFeatured).toBe(true)

      // children first, then the root → storefront confirms removal
      expect((await s.deleteCategory(admin, childId)).ok).toBe(true)
      expect((await s.deleteCategory(admin, root.data.id)).ok).toBe(true)
      const gone = await s.getCategory(root.data.id)
      expect(gone.ok).toBe(false)
      if (!gone.ok) expect(gone.error.code).toBe('NOT_FOUND')
    })

    it('promotional-category round-trip: create → add/set/toggle/move quantity → update → remove → delete', async () => {
      const s = makeService()
      const promoA = await s.createPromotionalCategory(admin, {
        name: 'Conformance Admin Promo A', slug: 'conformance-admin-promo-a', displayOrder: 42,
      })
      expect(promoA.ok).toBe(true)
      if (!promoA.ok) return
      expect(() => v1.PromotionalCategorySchema.parse(promoA.data)).not.toThrow()
      expect(promoA.data.isActive).toBe(true)

      const promoB = await s.createPromotionalCategory(admin, {
        name: 'Conformance Admin Promo B', slug: 'conformance-admin-promo-b', displayOrder: 43,
      })
      if (!promoB.ok) throw new Error('setup failed')

      // allocated quantities are repo-side relationship data — not readable
      // through the contract surface — so quantity ops pin ok + effects that
      // ARE observable (slug resolution, removal, counts)
      expect((await s.addProductToPromotionalCategory(admin, promoA.data.id, 'conformance-p1', 5)).ok).toBe(true)
      expect((await s.setPromotionalCategoryQuantity(admin, promoA.data.id, 'conformance-p1', 3)).ok).toBe(true)
      expect((await s.toggleProductInPromotionalCategory(admin, promoA.data.id, 'conformance-p1', false)).ok).toBe(true)
      expect((await s.toggleProductInPromotionalCategory(admin, promoA.data.id, 'conformance-p1', true)).ok).toBe(true)

      // storefront read confirms the promo resolves by slug
      const bySlug = await s.getPromotionalCategoryBySlug('conformance-admin-promo-a')
      expect(bySlug.ok && bySlug.data.id).toBe(promoA.data.id)

      // move 2 of the 3 allocated A → B (repo MERGEs the destination membership)
      expect((await s.moveQuantity(admin, 'conformance-p1', promoA.data.id, promoB.data.id, 2)).ok).toBe(true)

      const updated = await s.updatePromotionalCategory(admin, promoA.data.id, { name: 'Conformance Admin Promo A v2' })
      expect(updated.ok && updated.data.name).toBe('Conformance Admin Promo A v2')

      // cleanup: the product now sits in BOTH categories after the move
      expect((await s.removeProductFromPromotionalCategory(admin, promoA.data.id, 'conformance-p1')).ok).toBe(true)
      expect((await s.removeProductFromPromotionalCategory(admin, promoB.data.id, 'conformance-p1')).ok).toBe(true)
      expect((await s.deletePromotionalCategory(admin, promoB.data.id)).ok).toBe(true)
      expect((await s.deletePromotionalCategory(admin, promoA.data.id)).ok).toBe(true)
      const gone = await s.getPromotionalCategoryBySlug('conformance-admin-promo-a')
      expect(gone.ok).toBe(false)
      if (!gone.ok) expect(gone.error.code).toBe('NOT_FOUND')
    })

    it('hero round-trip: create → update with null-clearing → reorder → storefront read → delete', async () => {
      const s = makeService()
      const a = await s.createHeroSlide(admin, {
        imageUrl: 'http://minio.test/hero/admin-a.webp',
        mobileImageUrl: 'http://minio.test/hero/admin-a-mobile.webp',
        animationType: 'left-panel',
        colorTheme: 'light',
        badgeText: 'Admin',
        title: 'Conformance Admin Hero A',
        subtitle: 'sub-a',
        displayOrder: 10,
      })
      expect(a.ok).toBe(true)
      if (!a.ok) return
      expect(() => v1.HeroSlideSchema.parse(a.data)).not.toThrow()
      expect(a.data.isActive).toBe(true) // defaults engine-side

      const b = await s.createHeroSlide(admin, heroCreate(11))
      if (!b.ok) throw new Error('setup failed')

      // update sets badgeText and null-CLEARS mobileImageUrl (HeroSlideUpdateInput
      // discipline) — the cleared field must vanish (undefined), not linger as null
      const updated = await s.updateHeroSlide(admin, a.data.id, { badgeText: 'Admin2', mobileImageUrl: null })
      expect(updated.ok).toBe(true)
      if (!updated.ok) return
      expect(updated.data.badgeText).toBe('Admin2')
      expect(updated.data.mobileImageUrl).toBeUndefined()
      expect(() => v1.HeroSlideSchema.parse(updated.data)).not.toThrow()

      // swap the two display orders; verify through the storefront read
      const reordered = await s.reorderHeroSlides(admin, [
        { id: a.data.id, displayOrder: 11 },
        { id: b.data.id, displayOrder: 10 },
      ])
      expect(reordered.ok).toBe(true)
      const slides = await s.listHeroSlides()
      expect(slides.ok).toBe(true)
      if (!slides.ok) return
      expect(slides.data.find((h) => h.id === a.data.id)?.displayOrder).toBe(11)
      expect(slides.data.find((h) => h.id === b.data.id)?.displayOrder).toBe(10)

      expect((await s.deleteHeroSlide(admin, b.data.id)).ok).toBe(true)
      expect((await s.deleteHeroSlide(admin, a.data.id)).ok).toBe(true)
      const cleaned = await s.listHeroSlides()
      expect(cleaned.ok && cleaned.data.some((h) => h.id === a.data.id)).toBe(false)
    })

    it('color round-trip: create → list → toggle active → count tracks create/delete', async () => {
      const s = makeService()
      const before = await s.colorCount(admin)
      expect(before.ok).toBe(true)
      if (!before.ok) return

      const created = await s.createColor(admin, 'Conformance Blue', '#0f3dc4')
      expect(created.ok).toBe(true)
      if (!created.ok) return
      expect(() => v1.ColorDTOSchema.parse(created.data)).not.toThrow()
      expect(created.data.isActive).toBe(true)

      const listed = await s.listColors(admin)
      expect(listed.ok && listed.data.some((c) => c.id === created.data.id)).toBe(true)

      const afterCreate = await s.colorCount(admin)
      expect(afterCreate.ok && afterCreate.data).toBe(before.data + 1)

      const toggled = await s.toggleColorActive(admin, created.data.id)
      expect(toggled.ok && toggled.data.isActive).toBe(false)

      expect((await s.deleteColor(admin, created.data.id)).ok).toBe(true)
      const afterDelete = await s.colorCount(admin)
      expect(afterDelete.ok && afterDelete.data).toBe(before.data)
      const gone = await s.listColors(admin)
      expect(gone.ok && gone.data.some((c) => c.id === created.data.id)).toBe(false)
    })

    it('order admin block: listAllOrders returns the cart user’s checkout WITH items; updateOrderStatus PENDING→CONFIRMED', async () => {
      const s = makeService()
      // checkout as the cart-world user (storefront surface)
      await s.clearCart(cartUser)
      await s.addItem(cartUser, 'conformance-v1', 1)
      const created = await s.createOrder(cartUser.userId, { shippingAddress: address, deliveryMethod: 'SHIP' })
      expect(created.ok).toBe(true)
      if (!created.ok) return
      expect(created.data.status).toBe('PENDING')

      const listed = await s.listAllOrders(admin)
      expect(listed.ok).toBe(true)
      if (!listed.ok) return
      const mine = listed.data.find((o) => o.id === created.data.id)
      expect(mine).toBeDefined()
      // Task 1 pin: the admin list maps to OrderDTO INCLUDING items
      expect(() => v1.OrderSchema.parse(mine!)).not.toThrow()
      expect(mine!.items.some((i) => i.variantId === 'conformance-v1')).toBe(true)

      expect((await s.updateOrderStatus(admin, created.data.id, 'CONFIRMED')).ok).toBe(true)
      // the transition is visible through the storefront owner read
      const got = await s.getOrder(cartUser.userId, created.data.id)
      expect(got.ok && got.data.status).toBe('CONFIRMED')

      // no deleteOrder exists in the contract — restore the seeded cart lines
      // (2 × conformance-v1) and leave the order row to runner-side teardown
      await s.clearCart(cartUser)
      await s.addItem(cartUser, 'conformance-v1', 2)
    })

    it('listNewArrivals returns the world products newest-first and honors limit', async () => {
      const s = makeService()
      const r = await s.listNewArrivals()
      expect(r.ok).toBe(true)
      if (!r.ok) return
      // blocks above delete what they create, so the world is back to its
      // seeded two products — p1 (2026-01-02) before p2 (2026-01-01)
      expect(r.data.map((p) => p.id)).toEqual(['conformance-p1', 'conformance-p2'])
      for (const p of r.data) expect(() => v1.ProductSchema.parse(p)).not.toThrow()
      const limited = await s.listNewArrivals(1)
      expect(limited.ok && limited.data.map((p) => p.id)).toEqual(['conformance-p1'])
    })
  })
}
