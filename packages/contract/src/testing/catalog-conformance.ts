import { describe, it, expect } from 'vitest'
import * as v1 from '../v1'
import { worldProducts, worldCategories, worldPromoCategory, worldHeroSlides } from './catalog-world'

export function runCatalogConformance(
  suiteName: string,
  makeService: () => v1.CatalogService,
) {
  describe(`${suiteName}: CatalogService v1 conformance`, () => {
    it('listProducts returns newest-first with totals', async () => {
      const r = await makeService().listProducts()
      expect(r.ok).toBe(true)
      if (!r.ok) return
      expect(r.data.total).toBe(worldProducts.length)
      expect(r.data.items.map((p) => p.id)).toEqual(['conformance-p1', 'conformance-p2']) // createdAt DESC
      expect(() => v1.ProductSchema.parse(r.data.items[0])).not.toThrow()
    })

    it('listProducts filters by brand', async () => {
      const r = await makeService().listProducts({ brand: 'Boralus' })
      expect(r.ok).toBe(true)
      if (r.ok) expect(r.data.items.map((p) => p.id)).toEqual(['conformance-p2'])
    })

    it('listProducts limit+offset page', async () => {
      const r = await makeService().listProducts({ limit: 1, offset: 1 })
      expect(r.ok).toBe(true)
      if (r.ok) expect(r.data.items.map((p) => p.id)).toEqual(['conformance-p2'])
    })

    it('getProduct returns the product', async () => {
      const r = await makeService().getProduct('conformance-p1')
      expect(r.ok).toBe(true)
      if (r.ok) expect(r.data.variants).toHaveLength(2)
    })

    it('getProduct unknown id → NOT_FOUND', async () => {
      const r = await makeService().getProduct('does-not-exist')
      expect(r.ok).toBe(false)
      if (!r.ok) expect(r.error.code).toBe('NOT_FOUND')
    })

    it('searchProducts matches name case-insensitively', async () => {
      const r = await makeService().searchProducts('hoodie')
      expect(r.ok).toBe(true)
      if (r.ok) expect(r.data.map((p) => p.id)).toEqual(['conformance-p2'])
    })

    it('listBrands returns distinct brands', async () => {
      const r = await makeService().listBrands()
      expect(r.ok).toBe(true)
      if (r.ok) expect(r.data.sort()).toEqual(['Acme', 'Boralus'])
    })

    it('getCategory returns the category', async () => {
      const r = await makeService().getCategory('conformance-c1')
      expect(r.ok).toBe(true)
      if (r.ok) expect(r.data.slug).toBe('tops')
    })

    it('getCategoryTree returns tree nodes', async () => {
      const r = await makeService().getCategoryTree()
      expect(r.ok).toBe(true)
      if (r.ok) expect(r.data.some((c) => c.id === 'conformance-c1')).toBe(true)
    })

    it('getPromotionalCategoryBySlug resolves', async () => {
      const r = await makeService().getPromotionalCategoryBySlug('conformance-sale')
      expect(r.ok).toBe(true)
      if (r.ok) expect(r.data.id).toBe('conformance-promo1')
    })

    it('listHeroSlides activeOnly filters', async () => {
      const all = await makeService().listHeroSlides()
      const active = await makeService().listHeroSlides(true)
      expect(all.ok && active.ok).toBe(true)
      if (all.ok) expect(all.data).toHaveLength(2)
      if (active.ok) expect(active.data.map((s) => s.id)).toEqual(['conformance-h1'])
    })
  })
}
