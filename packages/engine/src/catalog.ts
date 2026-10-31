import type { v1 } from '@softx/contract'
import type { EngineConfig, TenantRef } from './engine'

const notImplemented = (method: string) => () => {
  throw new Error(`catalog service implemented in Task 8 (attempted to call '${method}')`)
}

/**
 * Task 8 stub. Returns a service object whose methods all throw, so the
 * engine scaffold can be wired and tested before the catalog service
 * implementation lands (Task 8 replaces this body).
 */
export function createCatalogService(
  _config: EngineConfig,
  _tenant: TenantRef
): v1.CatalogService {
  return {
    listProducts: notImplemented('listProducts'),
    getProduct: notImplemented('getProduct'),
    searchProducts: notImplemented('searchProducts'),
    listBrands: notImplemented('listBrands'),
    listProductsByCategories: notImplemented('listProductsByCategories'),
    getCategory: notImplemented('getCategory'),
    getCategoryTree: notImplemented('getCategoryTree'),
    listPromotionalCategories: notImplemented('listPromotionalCategories'),
    getPromotionalCategoryBySlug: notImplemented('getPromotionalCategoryBySlug'),
    listProductsByPromotionalCategory: notImplemented('listProductsByPromotionalCategory'),
    listHeroSlides: notImplemented('listHeroSlides'),
  }
}
