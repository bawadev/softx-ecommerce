import { v1 } from '@softx/contract'
import type { Session } from 'neo4j-driver'
import type { EngineConfig, TenantRef } from './engine'
import { getSession } from './db'
import { toProductDTO, toCategoryDTO, toPromotionalCategoryDTO, toHeroSlideDTO } from './mappers/catalog.mapper'
import * as productRepo from './repositories/product.repository'
import * as categoryRepo from './repositories/category.repository'
import * as promoRepo from './repositories/promotional-category.repository'
import * as heroRepo from './repositories/hero-slide.repository'

const { ok, err } = v1

/** Explicit cap for promo-category product listings; matches ListProductsQuerySchema's max (the repo would otherwise silently default to 20). */
const PROMO_CATEGORY_PRODUCT_LIMIT = 200

/** Newest-first cap for category product listings; parity with the pre-contract inline Cypher (ORDER BY p.createdAt DESC LIMIT 50) the app's category browsing relied on. */
const CATEGORY_PRODUCTS_LIMIT = 50

/**
 * Catalog service v1. Maps the engine's repositories (raw Neo4j shapes,
 * deprecated fields, major-unit prices) onto the `v1.CatalogService`
 * contract (DTOs, Money in minor units).
 *
 * Repository signature adaptations (vs. the Task 8 brief):
 * - category/promotional-category/hero-slide repositories take a Neo4j
 *   `Session` as their first argument; `withSession` opens one per call
 *   (targeting `config.neo4j.database` when set) and closes it in `finally`.
 * - `getAllHeroSlides(session, activeOnly)` and
 *   `getAllPromotionalCategories(session, activeOnly)` take `activeOnly`
 *   (not `includeInactive`), so the includeInactive-facing contract method
 *   negates the flag when forwarding.
 * - `getCategoryTree(session)` returns a hierarchy-keyed map
 *   (`{ [hierarchy]: CategoryWithChildren[] }`); the contract expects a flat
 *   `CategoryTreeDTO[]` of root nodes, so the values are flattened.
 * - The engine has no `getFullProductsByCategories`; products for
 *   `listProductsByCategories` are resolved by composing
 *   `getProductsByCategories` (IDs, includes descendants) with
 *   `getProductById` per ID.
 */
export function createCatalogService(config: EngineConfig, _tenant: TenantRef): v1.CatalogService {
  const currency = config.defaultCurrency ?? 'LKR'

  async function withSession<T>(fn: (session: Session) => Promise<T>): Promise<T> {
    const session = getSession(config.neo4j.database)
    try {
      return await fn(session)
    } finally {
      await session.close()
    }
  }

  return {
    async listProducts(query = {}) {
      try {
        const limit = query.limit ?? 50
        const offset = query.offset ?? 0
        const filters = {
          ...(query.brand !== undefined ? { brand: query.brand } : {}),
          ...(query.gender !== undefined ? { gender: query.gender } : {}),
          ...(query.minPrice !== undefined ? { minPrice: query.minPrice } : {}),
          ...(query.maxPrice !== undefined ? { maxPrice: query.maxPrice } : {}),
          ...(query.search !== undefined ? { search: query.search } : {}),
        }
        const [all, total] = await Promise.all([
          productRepo.getAllProducts(
            Object.keys(filters).length > 0 ? filters : undefined,
            limit + offset
          ),
          productRepo.getProductCount(Object.keys(filters).length > 0 ? filters : undefined),
        ])
        const items = all.slice(offset, offset + limit).map((p) => toProductDTO(p, currency))
        return ok({ items, total, limit, offset })
      } catch (e) {
        return err('UNAVAILABLE', 'Failed to list products', { cause: String(e) })
      }
    },

    async getProduct(id) {
      try {
        const p = await productRepo.getProductById(id)
        return p ? ok(toProductDTO(p, currency)) : err('NOT_FOUND', `Product ${id} not found`)
      } catch (e) {
        return err('UNAVAILABLE', 'Failed to get product', { cause: String(e) })
      }
    },

    async searchProducts(term) {
      try {
        const products = await productRepo.searchProducts(term)
        return ok(products.map((p) => toProductDTO(p, currency)))
      } catch (e) {
        return err('UNAVAILABLE', 'Failed to search products', { cause: String(e) })
      }
    },

    async listBrands() {
      try {
        return ok(await productRepo.getAllBrands())
      } catch (e) {
        return err('UNAVAILABLE', 'Failed to list brands', { cause: String(e) })
      }
    },

    async listProductsByCategories(categoryIds) {
      try {
        const productIds = await withSession((session) =>
          categoryRepo.getProductsByCategories(session, categoryIds)
        )
        const products = await Promise.all(productIds.map((id) => productRepo.getProductById(id)))
        return ok(
          products
            .filter((p): p is productRepo.ProductWithVariants => p !== null)
            // Newest first, capped — parity with the pre-contract behavior.
            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
            .slice(0, CATEGORY_PRODUCTS_LIMIT)
            .map((p) => toProductDTO(p, currency))
        )
      } catch (e) {
        return err('UNAVAILABLE', 'Failed to list products by categories', { cause: String(e) })
      }
    },

    async getCategory(id) {
      try {
        const c = await withSession((session) => categoryRepo.getCategoryById(session, id))
        return c ? ok(toCategoryDTO(c)) : err('NOT_FOUND', `Category ${id} not found`)
      } catch (e) {
        return err('UNAVAILABLE', 'Failed to get category', { cause: String(e) })
      }
    },

    async getCategoryTree() {
      try {
        const tree = await withSession((session) => categoryRepo.getCategoryTree(session))
        const mapTree = (c: categoryRepo.CategoryWithChildren): v1.CategoryTreeDTO => ({
          ...toCategoryDTO(c),
          children: c.children.map(mapTree),
        })
        return ok(Object.values(tree).flat().map(mapTree))
      } catch (e) {
        return err('UNAVAILABLE', 'Failed to get category tree', { cause: String(e) })
      }
    },

    async listPromotionalCategories(includeInactive = false) {
      try {
        const cats = await withSession((session) =>
          promoRepo.getAllPromotionalCategories(session, !includeInactive)
        )
        return ok(cats.map(toPromotionalCategoryDTO))
      } catch (e) {
        return err('UNAVAILABLE', 'Failed to list promotional categories', { cause: String(e) })
      }
    },

    async getPromotionalCategoryBySlug(slug) {
      try {
        const c = await withSession((session) =>
          promoRepo.getPromotionalCategoryBySlug(session, slug)
        )
        return c ? ok(toPromotionalCategoryDTO(c)) : err('NOT_FOUND', `Promotional category ${slug} not found`)
      } catch (e) {
        return err('UNAVAILABLE', 'Failed to get promotional category', { cause: String(e) })
      }
    },

    async listProductsByPromotionalCategory(categoryId) {
      try {
        const products = await withSession((session) =>
          promoRepo.getProductsByCategory(session, categoryId, PROMO_CATEGORY_PRODUCT_LIMIT)
        )
        return ok(products.map((p) => toProductDTO(p, currency)))
      } catch (e) {
        return err('UNAVAILABLE', 'Failed to list products by promo category', { cause: String(e) })
      }
    },

    async listHeroSlides(activeOnly = false) {
      try {
        const slides = await withSession((session) =>
          heroRepo.getAllHeroSlides(session, activeOnly)
        )
        return ok(slides.map(toHeroSlideDTO))
      } catch (e) {
        return err('UNAVAILABLE', 'Failed to list hero slides', { cause: String(e) })
      }
    },
  }
}
