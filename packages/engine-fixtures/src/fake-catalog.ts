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

// ---------------------------------------------------------------------------
// Per-object world copies
//
// The module-level world fixtures are shared by EVERY state instance (the
// cart fake's hydration still reads them directly). A shallow array copy is
// not enough: an admin write that mutates a product/category/slide object in
// place would leak into `worldProducts` and every other state — so each state
// creation deep-copies the entities it can mutate (nested Money objects,
// image arrays, variants, custom panel styles included).
// ---------------------------------------------------------------------------

function cloneProduct(p: v1.ProductDTO): v1.ProductDTO {
  return {
    ...p,
    price: { stock: { ...p.price.stock }, retail: { ...p.price.retail } },
    images: [...p.images],
    variants: p.variants.map((variant) => ({ ...variant })),
  }
}

function cloneCategory(c: v1.CategoryDTO): v1.CategoryDTO {
  return { ...c }
}

function clonePromo(c: v1.PromotionalCategoryDTO): v1.PromotionalCategoryDTO {
  return { ...c }
}

function cloneSlide(s: v1.HeroSlideDTO): v1.HeroSlideDTO {
  return {
    ...s,
    ...(s.customDesktopStyle !== undefined
      ? { customDesktopStyle: { ...s.customDesktopStyle } }
      : {}),
    ...(s.customMobileStyle !== undefined
      ? { customMobileStyle: { ...s.customMobileStyle } }
      : {}),
  }
}

/**
 * Stored `HAS_ITEM` relationship row (promotional-category membership).
 * Allocated/sold/isActive are relationship data — they never enter a contract
 * DTO, exactly as the suite's quantity-ops comments note.
 */
export interface FakePromoItem {
  categoryId: string
  productId: string
  allocatedQuantity: number
  soldQuantity: number
  isActive: boolean
}

/**
 * Shared per-runner fake catalog state: the mutable entity lists (per-object
 * copies of the fixture worlds) plus the relationship data the admin fake
 * writes (`productCategories` = `HAS_CATEGORY` memberships keyed by productId,
 * `promoItems` = `HAS_ITEM` rows keyed `categoryId:productId`, `colors` =
 * `:Color` rows — no world seed for those) and the storefront service that
 * reads the SAME lists. The fake ADMIN services (fake-admin.ts) mutate these
 * lists so admin writes are visible through storefront reads (getProduct,
 * getPromotionalCategoryBySlug, listHeroSlides, listNewArrivals) — a runner
 * composing catalog + admin services must build ONE state instance and share
 * it, exactly like `createFakeEngine().for()` does.
 */
export interface FakeCatalogState {
  products: v1.ProductDTO[]
  categories: v1.CategoryDTO[]
  promos: v1.PromotionalCategoryDTO[]
  slides: v1.HeroSlideDTO[]
  colors: v1.ColorDTO[]
  productCategories: Map<string, Set<string>>
  promoItems: Map<string, FakePromoItem>
  catalogService: v1.CatalogService
}

export function createFakeCatalogState(): FakeCatalogState {
  const products = worldProducts.map(cloneProduct)
  const categories = worldCategories.map(cloneCategory)
  const promos = [clonePromo(worldPromoCategory)]
  const slides = worldHeroSlides.map(cloneSlide)
  const colors: v1.ColorDTO[] = []
  // catalog-world's seed creates no HAS_CATEGORY / HAS_ITEM relationships.
  const productCategories = new Map<string, Set<string>>()
  const promoItems = new Map<string, FakePromoItem>()

  const matchesQuery = (p: v1.ProductDTO, q: Partial<v1.ListProductsQuery>) =>
    (q.brand === undefined || p.brand === q.brand) &&
    (q.gender === undefined || p.gender === q.gender) &&
    (q.search === undefined || p.name.toLowerCase().includes(q.search.toLowerCase()))

  const catalogService: v1.CatalogService = {
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
      // Roots (parentId null) with children nested by parentId — the shape
      // the repo's tree query produces, flattened to a root list by the
      // engine's mapper.
      const byId = new Map(categories.map((c) => [c.id, { ...c, children: [] as v1.CategoryTreeDTO[] }]))
      const roots: v1.CategoryTreeDTO[] = []
      for (const node of byId.values()) {
        if (node.parentId === null) roots.push(node)
        else byId.get(node.parentId)?.children.push(node)
      }
      return v1.ok(roots)
    },
    async listPromotionalCategories(includeInactive = false) {
      // parity with promoRepo.getAllPromotionalCategories(activeOnly):
      // displayOrder ASC, active-filtered unless inactive are requested.
      const ordered = promos.slice().sort((a, b) => a.displayOrder - b.displayOrder)
      return v1.ok(includeInactive ? ordered : ordered.filter((c) => c.isActive))
    },
    async getPromotionalCategoryBySlug(slug) {
      const c = promos.find((x) => x.slug === slug)
      return c ? v1.ok(c) : v1.err('NOT_FOUND', `Promotional category ${slug} not found`)
    },
    async listProductsByPromotionalCategory() {
      return v1.ok(products)
    },
    async listHeroSlides(activeOnly = false) {
      // parity with heroRepo.getAllHeroSlides: displayOrder ASC.
      const ordered = slides.slice().sort((a, b) => a.displayOrder - b.displayOrder)
      return v1.ok(activeOnly ? ordered.filter((s) => s.isActive) : ordered)
    },
  }

  return {
    products,
    categories,
    promos,
    slides,
    colors,
    productCategories,
    promoItems,
    catalogService,
  }
}

/**
 * Backwards-compatible standalone catalog service owning its own state — use
 * createFakeCatalogState() directly when an admin service must share the
 * catalog lists.
 */
export function createFakeCatalogService(): v1.CatalogService {
  return createFakeCatalogState().catalogService
}
