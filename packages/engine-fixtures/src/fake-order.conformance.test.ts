import { runOrderConformance } from '@softx/contract/testing'
import { createFakeCatalogService } from './fake-catalog'
import { createFakeCartState } from './fake-cart'
import { createFakeOrderService } from './fake-order'

runOrderConformance('engine-fixtures', () => {
  // ONE cart state shared by the cart and order services — createOrder reads
  // the cart and clears it after success, so both must see the same storage.
  const state = createFakeCartState()
  return {
    ...createFakeCatalogService(),
    ...state.cartService,
    ...createFakeOrderService(state),
  }
})
