import { v1 } from '@softx/contract'
import type { OrderWithItems } from '../repositories/order.repository'
import { convertNeo4jIntegers } from '../neo4j-utils'

/**
 * Map a repository order (major-unit prices, repo-only fields, hydrated
 * product/variant JOIN data) onto `v1.OrderDTO`.
 *
 * `userId` is intentionally dropped — ownership stays server-side and never
 * enters a DTO. Item money converts through `fromMajorAmount` (major → minor,
 * rounded), and the item's display fields reduce to what the order UI
 * renders: productName/productId/productBrand from the JOINed product,
 * variantSize/variantColor from the JOINed variant, and productImage
 * preferring variant.images[0] with product.images[0] as fallback.
 *
 * The hydrated product/variant blocks come from an OPTIONAL MATCH over
 * ITEM_OF_VARIANT→VARIANT_OF, so admin deleteVariant/deleteProduct
 * (DETACH DELETE) leaves historical OrderItems with product:null /
 * variant:null. A severed item maps to placeholder display values instead
 * of throwing — productName '(unavailable)', productId/productBrand/
 * variantSize/variantColor '' — because OrderService wraps listOrders in
 * one try/catch and a single severed item would otherwise fail the user's
 * ENTIRE order list. Every field stays present: the v1 contract requires
 * all four display fields, and variantSize is a plain string so '' is
 * legal. productImage stays omitted (it was always optional). The
 * OrderItem's own properties (variantId/quantity/priceAtPurchase) always
 * survive; the ?? 0 on priceAtPurchase only guards a degenerate row that
 * lost the property.
 *
 * The repository returns raw Neo4j records, so integer properties (item
 * quantity, priceAtPurchase when integer-valued) arrive as Neo4j Integer
 * objects; the row is normalized with convertNeo4jIntegers first (same
 * defense as cart/catalog mappers). The JSON round-trip also strips
 * undefined optionals (paymentProof, addressLine2), which keeps the DTO
 * clean for zod's optional fields.
 */
export function toOrderDTO(order: OrderWithItems, currency: string): v1.OrderDTO {
  const src = convertNeo4jIntegers(order)
  const image = (item: OrderWithItems['items'][number]): string | undefined =>
    item.variant?.images?.[0] || item.product?.images?.[0] || undefined
  return {
    id: src.id,
    orderNumber: src.orderNumber,
    status: src.status,
    totalAmount: v1.fromMajorAmount(src.totalAmount, currency),
    shippingAddress: src.shippingAddress,
    deliveryMethod: src.deliveryMethod,
    ...(src.paymentProof ? { paymentProof: src.paymentProof } : {}),
    items: src.items.map((item) => {
      const productImage = image(item)
      return {
        variantId: item.variantId,
        quantity: item.quantity,
        priceAtPurchase: v1.fromMajorAmount(item.priceAtPurchase ?? 0, currency),
        productName: item.product?.name ?? '(unavailable)',
        ...(productImage ? { productImage } : {}),
        // Every display field stays present on severed links: '' placeholders
        // keep the v1 field-presence contract intact (variantSize is a plain
        // string precisely so '' is legal).
        productId: item.product?.id ?? '',
        productBrand: item.product?.brand ?? '',
        variantSize: item.variant?.size ?? '',
        variantColor: item.variant?.color ?? '',
      }
    }),
    createdAt: src.createdAt,
    updatedAt: src.updatedAt,
  }
}
