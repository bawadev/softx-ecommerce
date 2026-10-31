import { v1 } from '@softx/contract'
import { convertNeo4jIntegers, type ProductWithVariants } from '@softx/engine'

/**
 * Adapter: repository product → v1.ProductDTO.
 *
 * Used at server boundaries for read paths that are not yet served by an
 * engine catalog service (new arrivals, recommendations, recently viewed).
 * Removed when those paths move onto the engine (Phase 5).
 */
export function toProductDTO(p: ProductWithVariants): v1.ProductDTO {
  // The feeding repositories return raw Neo4j records, so integer properties
  // — variant stockQuantity today — arrive as Neo4j Integer objects, which
  // fail the contract's z.number().int() validation. Normalize defensively
  // before mapping (same treatment as the engine's catalog mapper).
  const src = convertNeo4jIntegers(p)
  return {
    id: src.id,
    name: src.name,
    description: src.description,
    brand: src.brand,
    gender: src.gender,
    sku: src.sku,
    price: {
      stock: v1.fromMajorAmount(src.stockPrice, defaultCurrency()),
      retail: v1.fromMajorAmount(src.retailPrice, defaultCurrency()),
    },
    images: src.images ?? [],
    createdAt: src.createdAt,
    updatedAt: src.updatedAt,
    variants: src.variants.map((v) => ({
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
