import { testing } from '@softx/contract'
import { createFakeCatalogService } from './fake-catalog'

testing.runCatalogConformance('engine-fixtures', () => createFakeCatalogService())
