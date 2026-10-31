import { money, type ProductDTO, type CategoryDTO, type PromotionalCategoryDTO, type HeroSlideDTO } from '../v1'

export const worldCurrency = 'LKR'

export const worldProducts: ProductDTO[] = [
  {
    id: 'conformance-p1',
    name: 'Conformance Classic Tee',
    description: 'Fixture product one',
    brand: 'Acme',
    gender: 'UNISEX',
    sku: 'CONF-TEE-1',
    price: { stock: money(249900, worldCurrency), retail: money(299900, worldCurrency) },
    images: ['http://minio.test/product-images/tee.webp'],
    createdAt: '2026-01-02T00:00:00.000Z',
    updatedAt: '2026-01-02T00:00:00.000Z',
    variants: [
      { id: 'conformance-v1', size: 'M', color: 'Black', stockQuantity: 5 },
      { id: 'conformance-v2', size: 'L', color: 'White', stockQuantity: 0 },
    ],
  },
  {
    id: 'conformance-p2',
    name: 'Conformance Hoodie',
    description: 'Fixture product two',
    brand: 'Boralus',
    gender: 'MEN',
    sku: 'CONF-HOOD-1',
    price: { stock: money(499900, worldCurrency), retail: money(599900, worldCurrency) },
    images: ['http://minio.test/product-images/hoodie.webp'],
    createdAt: '2026-01-01T00:00:00.000Z', // older — ordering matters for listProducts assertions
    updatedAt: '2026-01-01T00:00:00.000Z',
    variants: [{ id: 'conformance-v3', size: 'XL', color: 'Grey', stockQuantity: 2 }],
  },
]

export const worldCategories: CategoryDTO[] = [
  {
    id: 'conformance-c1', name: 'Tops', slug: 'tops', hierarchy: 'conformance',
    parentId: null, level: 0, isActive: true, isFeatured: true,
    createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
  },
]

export const worldPromoCategory: PromotionalCategoryDTO = {
  id: 'conformance-promo1', name: 'Conformance Sale', slug: 'conformance-sale',
  description: 'fixture promo', displayOrder: 1, isActive: true,
  createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
}

export const worldHeroSlides: HeroSlideDTO[] = [
  {
    id: 'conformance-h1', imageUrl: 'http://minio.test/hero/1.webp',
    animationType: 'left-panel', colorTheme: 'light',
    badgeText: 'New', title: 'Conformance Slide 1', subtitle: 'sub', displayOrder: 1, isActive: true,
  },
  {
    id: 'conformance-h2', imageUrl: 'http://minio.test/hero/2.webp',
    animationType: 'top-left-round', colorTheme: 'dark',
    badgeText: 'Old', title: 'Conformance Slide 2', subtitle: 'sub2', displayOrder: 2, isActive: false,
  },
]

// ---------------------------------------------------------------------------
// Graph seed — derived from the fixture entities above so the fake engine and
// the real-engine integration seed can never drift. Mirrors the storage model
// of the existing repositories:
//   - `:Product` stores prices major-unit (`stockPrice`/`retailPrice`)
//   - `(:ProductVariant)-[:VARIANT_OF]->(:Product)` (variant points at product)
//   - labels `:Category`, `:PromotionalCategory`, `:HeroSlide`
// ---------------------------------------------------------------------------

const q = (s: string) => `'${s.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`
const major = (amountMinor: number) => (amountMinor / 100).toFixed(2)

const productCypher = worldProducts
  .map((p, i) => {
    const product = `p${i}`
    const createProduct = [
      `CREATE (${product}:Product {id: ${q(p.id)}, name: ${q(p.name)}, description: ${q(p.description)},`,
      `  brand: ${q(p.brand)}, gender: ${q(p.gender)}, stockPrice: ${major(p.price.stock.amountMinor)}, retailPrice: ${major(p.price.retail.amountMinor)}, sku: ${q(p.sku)},`,
      `  images: [${p.images.map(q).join(', ')}],`,
      `  createdAt: ${q(p.createdAt)}, updatedAt: ${q(p.updatedAt)}})`,
    ].join('\n')
    const createVariants = p.variants
      .map(
        (v, j) =>
          `CREATE (${product}v${j}:ProductVariant {id: ${q(v.id)}, productId: ${q(p.id)}, size: ${q(v.size)}, color: ${q(v.color)}, stockQuantity: ${v.stockQuantity}, images: []})-[:VARIANT_OF]->(${product})`,
      )
      .join('\n')
    return `${createProduct}\n${createVariants}`
  })
  .join('\n')

const categoryCypher = worldCategories
  .map(
    (c, i) =>
      `CREATE (c${i}:Category {id: ${q(c.id)}, name: ${q(c.name)}, slug: ${q(c.slug)}, hierarchy: ${q(c.hierarchy)}, parentId: ${c.parentId === null ? 'null' : q(c.parentId)}, level: ${c.level}, isActive: ${c.isActive}, isFeatured: ${c.isFeatured}, createdAt: ${q(c.createdAt)}, updatedAt: ${q(c.updatedAt)}})`,
  )
  .join('\n')

const promoProps = [
  `id: ${q(worldPromoCategory.id)}`,
  `name: ${q(worldPromoCategory.name)}`,
  `slug: ${q(worldPromoCategory.slug)}`,
  ...(worldPromoCategory.description !== undefined
    ? [`description: ${q(worldPromoCategory.description)}`]
    : []),
  `displayOrder: ${worldPromoCategory.displayOrder}`,
  `isActive: ${worldPromoCategory.isActive}`,
  `createdAt: ${q(worldPromoCategory.createdAt)}`,
  `updatedAt: ${q(worldPromoCategory.updatedAt)}`,
].join(', ')
const promoCypher = `CREATE (promo:PromotionalCategory {${promoProps}})`

const heroCypher = worldHeroSlides
  .map((h, i) => {
    const props = [
      `id: ${q(h.id)}`,
      `imageUrl: ${q(h.imageUrl)}`,
      `animationType: ${q(h.animationType)}`,
      `colorTheme: ${q(h.colorTheme)}`,
      `badgeText: ${q(h.badgeText)}`,
      `title: ${q(h.title)}`,
      `subtitle: ${q(h.subtitle)}`,
      `displayOrder: ${h.displayOrder}`,
      `isActive: ${h.isActive}`,
    ].join(', ')
    return `CREATE (h${i}:HeroSlide {${props}})`
  })
  .join('\n')

export const seedCypher = [productCypher, categoryCypher, promoCypher, heroCypher].join('\n')

export const teardownCypher = `MATCH (n) WHERE n.id STARTS WITH 'conformance-' DETACH DELETE n`

export const catalogWorld = {
  currency: worldCurrency,
  products: worldProducts,
  categories: worldCategories,
  promotionalCategory: worldPromoCategory,
  heroSlides: worldHeroSlides,
  seedCypher,
  teardownCypher,
}
