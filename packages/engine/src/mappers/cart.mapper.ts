import { v1 } from '@softx/contract'
import type { CartItemWithDetails } from '../repositories/cart.repository'
import { convertNeo4jIntegers } from '../neo4j-utils'

export function toCartItemDTO(item: CartItemWithDetails, currency: string): v1.CartItemDTO {
  // The cart repository returns raw Neo4j records (record.get(...)), so
  // integer properties — cart quantity, product prices, variant
  // stockQuantity — arrive as Neo4j Integer objects, which fail the
  // contract's z.number().int() validation. Normalize the whole row
  // defensively before mapping (same defense as catalog.mapper).
  const src = convertNeo4jIntegers(item)
  return {
    variantId: src.variantId,
    quantity: src.quantity,
    product: {
      id: src.product.id,
      name: src.product.name,
      brand: src.product.brand,
      sku: src.product.sku,
      images: src.product.images ?? [],
      price: {
        stock: v1.fromMajorAmount(src.product.stockPrice, currency),
        retail: v1.fromMajorAmount(src.product.retailPrice, currency),
      },
    },
    variant: {
      id: src.variant.id,
      // CartItemWithDetails types size as plain string; the contract's
      // VariantSummarySchema constrains it to the SizeOption enum.
      size: src.variant.size as v1.VariantSummaryDTO['size'],
      color: src.variant.color,
      stockQuantity: src.variant.stockQuantity,
    },
  }
}

export function cartTotal(items: v1.CartItemDTO[], currency: string): v1.Money {
  return v1.money(
    items.reduce((sum, i) => sum + i.product.price.stock.amountMinor * i.quantity, 0),
    currency
  )
}
