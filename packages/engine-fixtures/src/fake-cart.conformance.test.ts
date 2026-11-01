import { runCartConformance } from '@softx/contract/testing'
import { createFakeCatalogService } from './fake-catalog'
import { createFakeCartService } from './fake-cart'

runCartConformance('engine-fixtures', () => ({
  ...createFakeCatalogService(),
  ...createFakeCartService(),
}))
