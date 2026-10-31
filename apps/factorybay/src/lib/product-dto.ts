import { v1 } from '@softx/contract'
import type { ProductWithVariants } from '@softx/engine'

/**
 * Adapter: repository product → v1.ProductDTO.
 *
 * Used at server boundaries for read paths that are not yet served by an
 * engine catalog service (new arrivals, recommendations, recently viewed).
 * Removed when those paths move onto the engine (Phase 5).
 */
export function toProductDTO(p: ProductWithVariants): v1.ProductDTO {
  return {
    id: p.id,
    name: p.name,
    description: p.description,
    brand: p.brand,
    gender: p.gender,
    sku: p.sku,
    price: {
      stock: v1.fromMajorAmount(p.stockPrice, defaultCurrency()),
      retail: v1.fromMajorAmount(p.retailPrice, defaultCurrency()),
    },
    images: p.images ?? [],
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
    variants: p.variants.map((v) => ({
      id: v.id,
      size: v.size,
      color: v.color,
      stockQuantity: v.stockQuantity,
    })),
  }
}

function defaultCurrency(): string {
  return process.env.DEFAULT_CURRENCY || 'LKR'
}
