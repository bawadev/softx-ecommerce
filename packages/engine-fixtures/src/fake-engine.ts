import type { v1 } from '@softx/contract'
import { createFakeCatalogService } from './fake-catalog'
import { createFakeCartState } from './fake-cart'
import { createFakeOrderService } from './fake-order'
import { createFakeAccountState } from './fake-account'

export interface FakeEngine {
  for(_tenant: { clientId: string }): {
    catalog: v1.CatalogService
    cart: v1.CartService
    order: v1.OrderService
    account: v1.AccountService
    profile: v1.ProfileService
  }
}

export function createFakeEngine(): FakeEngine {
  return {
    for: () => {
      // One cart state per tenant instance: the order service reads/clears
      // the same user carts the cart service serves.
      const cartState = createFakeCartState()
      // One account state per tenant instance: the profile service reads the
      // same users map the account service serves (view tracking requires
      // the user to exist, mirroring the repo's double MATCH).
      const accountState = createFakeAccountState()
      return {
        catalog: createFakeCatalogService(),
        cart: cartState.cartService,
        order: createFakeOrderService(cartState),
        account: accountState.accountService,
        profile: accountState.profileService,
      }
    },
  }
}
