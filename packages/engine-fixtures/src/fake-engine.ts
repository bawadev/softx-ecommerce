import type { v1 } from '@softx/contract'
import { createFakeCatalogService } from './fake-catalog'
import { createFakeCartService } from './fake-cart'

export interface FakeEngine {
  for(_tenant: { clientId: string }): { catalog: v1.CatalogService; cart: v1.CartService }
}

export function createFakeEngine(): FakeEngine {
  return {
    for: () => ({
      catalog: createFakeCatalogService(),
      cart: createFakeCartService(),
    }),
  }
}
