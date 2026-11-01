import { v1 } from '@softx/contract'
import type { EngineConfig, TenantRef } from './engine'
import { toCartItemDTO } from './mappers/cart.mapper'
import { toOrderDTO } from './mappers/order.mapper'
import * as orderRepo from './repositories/order.repository'
import * as cartRepo from './repositories/cart.repository'

const { ok, err } = v1

/** Free-shipping threshold in minor units — parity with order.ts:50 (subtotal >= 100 major ships free). */
const FREE_SHIPPING_THRESHOLD_MINOR = 100_00
/** Flat shipping fee in minor units (9.99 major). */
const SHIP_COST_MINOR = 999

/**
 * Pure shipping rule, minor units — parity with
 * apps/factorybay/src/app/actions/order.ts:50:
 *   shipping = deliveryMethod === 'SHIP' ? (subtotal >= 100 ? 0 : 9.99) : 0
 * Exported for hermetic unit tests; the order conformance suite cannot
 * reach the paid branch (every catalog-world variant costs >= 100.00).
 */
export function computeShippingMinor(
  deliveryMethod: v1.OrderDTO['deliveryMethod'],
  subtotalMinor: number
): number {
  if (deliveryMethod !== 'SHIP') return 0
  return subtotalMinor >= FREE_SHIPPING_THRESHOLD_MINOR ? 0 : SHIP_COST_MINOR
}

/**
 * Order service v1. Totals are computed server-side from the user's DB cart
 * (never trusted from the client), orders are created through
 * order.repository (tenant database threaded), and the cart is cleared only
 * after a successful write. Reads and proof attachment enforce ownership
 * against the persisted order.userId before anything is mapped.
 *
 * Repository signature adaptations (vs. the Task 4 brief):
 * - order.repository functions take an optional trailing `database`
 *   argument; every call forwards `config.neo4j.database`.
 * - `createOrder` generates the order id and `FB-<timestamp>` orderNumber
 *   itself and stores prices in MAJOR units (legacy parity), so the service
 *   computes exact minor-unit totals and divides by 100 only at the repo
 *   boundary (`fromMajorAmount` rounds on the way back out).
 * - `createOrder`/`updateOrderPaymentProof` return an Order WITHOUT items,
 *   but `v1.OrderDTO` requires them — both paths re-fetch through
 *   `getOrderById` (items hydrated via JOIN) before mapping.
 */
export function createOrderService(config: EngineConfig, _tenant: TenantRef): v1.OrderService {
  const currency = config.defaultCurrency ?? 'LKR'
  const db = config.neo4j.database

  /** The user-cart read used for totals — the same rows getCart maps. */
  async function userCartItems(userId: string): Promise<v1.CartItemDTO[]> {
    const rows = await cartRepo.getCartItems(userId, db)
    return rows.map((r) => toCartItemDTO(r, currency))
  }

  return {
    async createOrder(userId, command) {
      try {
        const items = await userCartItems(userId)
        if (items.length === 0) return err('VALIDATION', 'Cart is empty')

        const subtotalMinor = items.reduce(
          (n, i) => n + i.product.price.stock.amountMinor * i.quantity,
          0
        )
        const shippingMinor = computeShippingMinor(command.deliveryMethod, subtotalMinor)

        const created = await orderRepo.createOrder(
          {
            userId,
            items: items.map((i) => ({
              variantId: i.variantId,
              quantity: i.quantity,
              priceAtPurchase: i.product.price.stock.amountMinor / 100,
            })),
            shippingAddress: command.shippingAddress,
            deliveryMethod: command.deliveryMethod,
            totalAmount: (subtotalMinor + shippingMinor) / 100,
          },
          db
        )
        await cartRepo.clearCart(userId, db)

        // createOrder returns no items; re-fetch the persisted order (items
        // hydrated via JOIN) so the DTO reflects what was actually written.
        const full = await orderRepo.getOrderById(created.id, db)
        if (!full) {
          return err('UNAVAILABLE', `Order ${created.id} not found after creation`)
        }
        return ok(toOrderDTO(full, currency))
      } catch (e) {
        return err('UNAVAILABLE', 'Failed to create order', { cause: String(e) })
      }
    },

    async getOrder(userId, orderId) {
      try {
        const order = await orderRepo.getOrderById(orderId, db)
        if (!order) return err('NOT_FOUND', `Order ${orderId} not found`)
        if (order.userId !== userId) {
          return err('UNAUTHORIZED', 'Order does not belong to user')
        }
        return ok(toOrderDTO(order, currency))
      } catch (e) {
        return err('UNAVAILABLE', 'Failed to get order', { cause: String(e) })
      }
    },

    async listOrders(userId) {
      try {
        const orders = await orderRepo.getUserOrders(userId, db)
        return ok(orders.map((o) => toOrderDTO(o, currency)))
      } catch (e) {
        return err('UNAVAILABLE', 'Failed to list orders', { cause: String(e) })
      }
    },

    async attachPaymentProof(userId, orderId, proofUrl) {
      try {
        const order = await orderRepo.getOrderById(orderId, db)
        if (!order) return err('NOT_FOUND', `Order ${orderId} not found`)
        if (order.userId !== userId) {
          return err('UNAUTHORIZED', 'Order does not belong to user')
        }
        await orderRepo.updateOrderPaymentProof(orderId, userId, proofUrl, db)
        // The update returns an Order without items; re-fetch for the DTO.
        const updated = await orderRepo.getOrderById(orderId, db)
        if (!updated) {
          return err('UNAVAILABLE', `Order ${orderId} not found after update`)
        }
        return ok(toOrderDTO(updated, currency))
      } catch (e) {
        return err('UNAVAILABLE', 'Failed to attach payment proof', { cause: String(e) })
      }
    },
  }
}
