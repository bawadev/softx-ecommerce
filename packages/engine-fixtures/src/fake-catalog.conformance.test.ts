import { runCatalogConformance } from '@softx/contract/testing'
import { createFakeCatalogService } from './fake-catalog'

runCatalogConformance('engine-fixtures', () => createFakeCatalogService())
