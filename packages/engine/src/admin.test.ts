import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import type { v1 } from '@softx/contract'
import { createEngine } from './engine'

/**
 * Hermetic actor-authorization unit test for the admin services (Phase 5
 * Task 3). No database is required or contacted: every admin method's FIRST
 * statement is the actor guard, so a non-admin call resolves UNAUTHORIZED
 * before any repository or session work happens.
 *
 * Guard-order proof (mock-free): the engine is built with an UNREACHABLE
 * Neo4j URI and the process env is pointed at a dead address for the
 * duration of the file. If any method opened a session before checking the
 * actor, the call would either fail with a connection error (→ UNAVAILABLE)
 * or stall past the test timeout — never the immediate UNAUTHORIZED these
 * assertions demand. db.ts reads NEO4J_URI lazily on the first getSession
 * call, which the guard prevents, so restoring the env afterwards leaves
 * nothing behind.
 */

/** Dead address — nothing listens on 127.0.0.1:1. */
const DEAD_URI = 'neo4j://127.0.0.1:1'

const engine = createEngine({
  neo4j: { uri: DEAD_URI, user: 'neo4j', password: 'not-a-real-password' },
})
const tenant = { clientId: 'factorybay' }
const anonymous: v1.ActorRef = { kind: 'anonymous' }
const customer: v1.ActorRef = { kind: 'customer', userId: 'conformance-cart-user' }

/** Minimal type-correct payloads — the guard fires before validation. */
const productCreate: v1.ProductCreateInput = {
  name: 'Gate Product',
  description: '',
  brand: 'GateBrand',
  gender: 'UNISEX',
  stockPrice: 1,
  retailPrice: 1,
  sku: 'GATE-1',
  images: [],
  variants: [{ size: 'M', color: 'Black', stockQuantity: 0 }],
}
const heroCreate: v1.HeroSlideWriteInput = {
  imageUrl: 'http://minio.test/hero/gate.webp',
  animationType: 'left-panel',
  badgeText: 'Gate',
  title: 'Gate',
  subtitle: 'Gate',
  displayOrder: 1,
}

/** Every admin method invoked with the given actor — label + pending Result. */
function everyAdminCall(actor: v1.ActorRef): Array<[string, Promise<v1.Result<unknown>>]> {
  const catalog = engine.for(tenant).adminCatalog
  const orders = engine.for(tenant).adminOrder
  return [
    // AdminCatalogService — products (9)
    ['createProduct', catalog.createProduct(actor, productCreate)],
    ['updateProduct', catalog.updateProduct(actor, 'gate-product', { name: 'Nope' })],
    ['deleteProduct', catalog.deleteProduct(actor, 'gate-product')],
    ['addVariant', catalog.addVariant(actor, 'gate-product', { size: 'M', color: 'Black', stockQuantity: 1 })],
    ['updateVariant', catalog.updateVariant(actor, 'gate-variant', { stockQuantity: 1 })],
    ['addProductImage', catalog.addProductImage(actor, 'gate-product', 'http://minio.test/i.webp')],
    ['removeProductImage', catalog.removeProductImage(actor, 'gate-product', 'http://minio.test/i.webp')],
    ['searchProductsByName', catalog.searchProductsByName(actor, 'gate')],
    ['checkProductNameExists', catalog.checkProductNameExists(actor, 'Gate Product')],
    // categories (7)
    ['createCategory', catalog.createCategory(actor, { name: 'Gate', hierarchy: 'gate' })],
    ['updateCategory', catalog.updateCategory(actor, 'gate-category', { name: 'Nope' })],
    ['deleteCategory', catalog.deleteCategory(actor, 'gate-category')],
    ['moveCategory', catalog.moveCategory(actor, 'gate-category', null)],
    ['assignProductToCategory', catalog.assignProductToCategory(actor, 'gate-product', 'gate-category')],
    ['assignProductToCategories', catalog.assignProductToCategories(actor, 'gate-product', ['gate-category'])],
    ['removeProductFromCategory', catalog.removeProductFromCategory(actor, 'gate-product', 'gate-category')],
    // promotional categories (8)
    ['createPromotionalCategory', catalog.createPromotionalCategory(actor, { name: 'Gate', slug: 'gate-promo', displayOrder: 1 })],
    ['updatePromotionalCategory', catalog.updatePromotionalCategory(actor, 'gate-promo', { name: 'Nope' })],
    ['deletePromotionalCategory', catalog.deletePromotionalCategory(actor, 'gate-promo')],
    ['addProductToPromotionalCategory', catalog.addProductToPromotionalCategory(actor, 'gate-promo', 'gate-product', 1)],
    ['removeProductFromPromotionalCategory', catalog.removeProductFromPromotionalCategory(actor, 'gate-promo', 'gate-product')],
    ['setPromotionalCategoryQuantity', catalog.setPromotionalCategoryQuantity(actor, 'gate-promo', 'gate-product', 1)],
    ['toggleProductInPromotionalCategory', catalog.toggleProductInPromotionalCategory(actor, 'gate-promo', 'gate-product', true)],
    ['moveQuantity', catalog.moveQuantity(actor, 'gate-product', 'gate-promo-a', 'gate-promo-b', 1)],
    // hero slides (4)
    ['createHeroSlide', catalog.createHeroSlide(actor, heroCreate)],
    ['updateHeroSlide', catalog.updateHeroSlide(actor, 'gate-slide', { badgeText: 'Nope' })],
    ['deleteHeroSlide', catalog.deleteHeroSlide(actor, 'gate-slide')],
    ['reorderHeroSlides', catalog.reorderHeroSlides(actor, [{ id: 'gate-slide', displayOrder: 1 }])],
    // colors (6)
    ['listColors', catalog.listColors(actor)],
    ['createColor', catalog.createColor(actor, 'Gate Blue', '#0000ff')],
    ['toggleColorActive', catalog.toggleColorActive(actor, 'gate-color')],
    ['deleteColor', catalog.deleteColor(actor, 'gate-color')],
    ['colorCount', catalog.colorCount(actor)],
    ['seedColors', catalog.seedColors(actor, [{ name: 'Gate Blue', hex: '#0000ff' }])],
    // AdminOrderService (2)
    ['listAllOrders', orders.listAllOrders(actor)],
    ['updateOrderStatus', orders.updateOrderStatus(actor, 'gate-order', 'CONFIRMED')],
  ]
}

/** Pins the surface size: 34 AdminCatalog + 2 AdminOrder = 36 actor-first methods. */
const ADMIN_METHOD_COUNT = 36

async function expectAllUnauthorized(actor: v1.ActorRef): Promise<void> {
  const calls = everyAdminCall(actor)
  expect(calls).toHaveLength(ADMIN_METHOD_COUNT)
  for (const [label, pending] of calls) {
    const r = await pending
    expect({
      label,
      ok: r.ok,
      code: r.ok ? undefined : r.error.code,
      message: r.ok ? undefined : r.error.message,
    }).toEqual({ label, ok: false, code: 'UNAUTHORIZED', message: 'Admin access required' })
  }
}

describe('admin services: actor authorization (guard-first, hermetic)', () => {
  let savedUri: string | undefined

  beforeAll(() => {
    // Tripwire: sessions resolve through db.ts's env-backed driver, so point
    // the env at the same dead address the engine config carries. The guards
    // prevent any session from ever being opened against it.
    savedUri = process.env.NEO4J_URI
    process.env.NEO4J_URI = DEAD_URI
  })

  afterAll(() => {
    if (savedUri === undefined) delete process.env.NEO4J_URI
    else process.env.NEO4J_URI = savedUri
  })

  it('rejects the anonymous actor on every admin method, before any session work', async () => {
    await expectAllUnauthorized(anonymous)
  })

  it('rejects the customer actor on every admin method (reads included)', async () => {
    await expectAllUnauthorized(customer)
  })

  it('a runtime-omitted actor is rejected too (JS callers skipping the first argument)', async () => {
    const r = await engine.for(tenant).adminCatalog.listColors(undefined as unknown as v1.ActorRef)
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.error.code).toBe('UNAUTHORIZED')
      expect(r.error.message).toBe('Admin access required')
    }
  })

  it('the actor bound via for(tenant, actor) does not bypass the per-call guard', async () => {
    // Tenant engine bound with an ADMIN actor — the per-call ActorRef stays
    // authoritative, so a non-admin call is still rejected.
    const bound = engine.for(tenant, { kind: 'admin', userId: 'gate-admin' })
    const r = await bound.adminOrder.listAllOrders(customer)
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.error.code).toBe('UNAUTHORIZED')
      expect(r.error.message).toBe('Admin access required')
    }
  })

  it('for(tenant) single-argument call sites keep working; admin getters are present', () => {
    const storefront = engine.for(tenant)
    expect(storefront.catalog).toBeDefined()
    expect(storefront.cart).toBeDefined()
    expect(storefront.order).toBeDefined()
    expect(storefront.account).toBeDefined()
    expect(storefront.profile).toBeDefined()
    expect(storefront.adminCatalog).toBeDefined()
    expect(storefront.adminOrder).toBeDefined()

    const bound = engine.for(tenant, { kind: 'admin', userId: 'gate-admin' })
    expect(bound.catalog).toBeDefined() // storefront getters unaffected by the actor
  })
})
