// `v1` (ok/err) comes from the contract root; the test world fixtures come
// from the `@softx/contract/testing` subpath (the root barrel deliberately
// does not re-export `testing` — it imports vitest and must stay out of app
// runtimes).
import { v1 } from '@softx/contract'
import {
  worldProducts,
  worldCategories,
  worldPromoCategory,
  worldHeroSlides,
} from '@softx/contract/testing'

export function createFakeCatalogService(): v1.CatalogService {
  const products = [...worldProducts]
  const categories = [...worldCategories]
  const promo = { ...worldPromoCategory }
  const slides = [...worldHeroSlides]

  const matchesQuery = (p: v1.ProductDTO, q: Partial<v1.ListProductsQuery>) =>
    (q.brand === undefined || p.brand === q.brand) &&
    (q.gender === undefined || p.gender === q.gender) &&
    (q.search === undefined || p.name.toLowerCase().includes(q.search.toLowerCase()))

  return {
    async listProducts(query = {}) {
      const limit = query.limit ?? 50
      const offset = query.offset ?? 0
      const filtered = products
        .filter((p) => matchesQuery(p, query))
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      return v1.ok({ items: filtered.slice(offset, offset + limit), total: filtered.length, limit, offset })
    },
    async listNewArrivals(limit = 10) {
      const inStock = (p: v1.ProductDTO) => p.variants.some((v) => v.stockQuantity > 0)
      return v1.ok(
        products
          .filter(inStock)
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
          .slice(0, limit)
      )
    },
    async getProduct(id) {
      const p = products.find((x) => x.id === id)
      return p ? v1.ok(p) : v1.err('NOT_FOUND', `Product ${id} not found`)
    },
    async searchProducts(term) {
      return v1.ok(products.filter((p) => p.name.toLowerCase().includes(term.toLowerCase())))
    },
    async listBrands() {
      return v1.ok([...new Set(products.map((p) => p.brand))])
    },
    async listProductsByCategories() {
      return v1.ok(products)
    },
    async getCategory(id) {
      const c = categories.find((x) => x.id === id)
      return c ? v1.ok(c) : v1.err('NOT_FOUND', `Category ${id} not found`)
    },
    async getCategoryTree() {
      return v1.ok(categories.map((c) => ({ ...c, children: [] })))
    },
    async listPromotionalCategories() {
      return v1.ok([promo])
    },
    async getPromotionalCategoryBySlug(slug) {
      return promo.slug === slug ? v1.ok(promo) : v1.err('NOT_FOUND', `Promotional category ${slug} not found`)
    },
    async listProductsByPromotionalCategory() {
      return v1.ok(products)
    },
    async listHeroSlides(activeOnly = false) {
      return v1.ok(activeOnly ? slides.filter((s) => s.isActive) : slides)
    },
  }
}
