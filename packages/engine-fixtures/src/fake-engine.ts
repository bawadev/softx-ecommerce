import type { v1 } from '@softx/contract'
import { createFakeCatalogService } from './fake-catalog'
import { createFakeCartState } from './fake-cart'
import { createFakeOrderService } from './fake-order'

export interface FakeEngine {
  for(_tenant: { clientId: string }): {
    catalog: v1.CatalogService
    cart: v1.CartService
    order: v1.OrderService
  }
}

export function createFakeEngine(): FakeEngine {
  return {
    for: () => {
      // One cart state per tenant instance: the order service reads/clears
      // the same user carts the cart service serves.
      const cartState = createFakeCartState()
      return {
        catalog: createFakeCatalogService(),
        cart: cartState.cartService,
        order: createFakeOrderService(cartState),
      }
    },
  }
}
