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
 * renders: productName from the JOINed product, productImage preferring
 * variant.images[0] with product.images[0] as fallback.
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
    item.variant.images?.[0] || item.product.images?.[0] || undefined
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
        priceAtPurchase: v1.fromMajorAmount(item.priceAtPurchase, currency),
        productName: item.product.name,
        ...(productImage ? { productImage } : {}),
      }
    }),
    createdAt: src.createdAt,
    updatedAt: src.updatedAt,
  }
}
