import { runAdminConformance, adminWorld } from '@softx/contract/testing'
import { createFakeEngine } from './fake-engine'

runAdminConformance('engine-fixtures', () => {
  // ONE engine instance: admin CRUD mutates the SAME catalog/order state the
  // storefront reads (getProduct, getPromotionalCategoryBySlug,
  // listHeroSlides, getOrder), and the checkout runs through the same cart
  // storage. The admin actor is BOUND on the engine (mirroring the app's
  // getAdminServices binding) but authorization reads the PER-CALL actor —
  // the gating blocks pass anonymous/customer actors against this same
  // composed object and must still get UNAUTHORIZED.
  const t = createFakeEngine().for({ clientId: 'conformance' }, adminWorld.actor)
  return {
    ...t.adminCatalog,
    ...t.adminOrder,
    ...t.catalog,
    ...t.order,
    ...t.cart,
  }
})
