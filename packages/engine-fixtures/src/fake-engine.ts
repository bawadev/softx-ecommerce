import type { v1 } from '@softx/contract'
import { createFakeCatalogService } from './fake-catalog'

export interface FakeEngine {
  for(_tenant: { clientId: string }): { catalog: v1.CatalogService }
}

export function createFakeEngine(): FakeEngine {
  return { for: () => ({ catalog: createFakeCatalogService() }) }
}
