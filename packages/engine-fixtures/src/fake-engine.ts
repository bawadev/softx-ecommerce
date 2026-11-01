import type { v1 } from '@softx/contract'
import { createFakeCatalogState } from './fake-catalog'
import { createFakeCartState } from './fake-cart'
import { createFakeOrderState } from './fake-order'
import { createFakeAccountState } from './fake-account'
import { createFakeAdminServices } from './fake-admin'

export interface FakeEngine {
  /**
   * Bind a tenant engine. The optional `actor` (Phase 5, additive — mirrors
   * the real engine's `for(tenant, actor?)`) captures the acting party for
   * the returned services; existing single-argument call sites keep working
   * with the actor left undefined. Authorization on the admin services
   * always reads the PER-CALL ActorRef (the contract passes it as every
   * method's first argument), so the captured actor is bound context only —
   * the admin conformance runner builds one instance with the ADMIN actor
   * bound and still exercises anonymous/customer gating through per-call
   * actors against the same composed service.
   */
  for(_tenant: { clientId: string }, _actor?: v1.ActorRef): {
    catalog: v1.CatalogService
    cart: v1.CartService
    order: v1.OrderService
    account: v1.AccountService
    profile: v1.ProfileService
    adminCatalog: v1.AdminCatalogService
    adminOrder: v1.AdminOrderService
  }
}

export function createFakeEngine(): FakeEngine {
  return {
    for: (_tenant, actor) => {
      // One cart state per tenant instance: the order service reads/clears
      // the same user carts the cart service serves.
      const cartState = createFakeCartState()
      // One account state per tenant instance: the profile service reads the
      // same users map the account service serves (view tracking requires
      // the user to exist, mirroring the repo's double MATCH).
      const accountState = createFakeAccountState()
      // One catalog + order state per tenant instance: admin CRUD (the
      // adminCatalog/adminOrder services) mutates the SAME product/category/
      // promo/hero/order lists the storefront catalog/order services read,
      // so admin writes are observable through storefront reads.
      const catalogState = createFakeCatalogState()
      const orderState = createFakeOrderState(cartState)
      const admin = createFakeAdminServices(catalogState, orderState, actor)
      return {
        catalog: catalogState.catalogService,
        cart: cartState.cartService,
        order: orderState.orderService,
        account: accountState.accountService,
        profile: accountState.profileService,
        adminCatalog: admin.adminCatalog,
        adminOrder: admin.adminOrder,
      }
    },
  }
}
