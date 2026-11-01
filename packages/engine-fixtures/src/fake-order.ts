// Fake OrderService v1 — in-memory orders over the SHARED fake cart state
// (createFakeCartState) and the catalog fixture world. The fake cannot import
// engine code, so the totals rule below duplicates the engine's literals —
// keep them in lockstep (see the parity comments). Prices always come from
// the cart's hydrated price.stock values (worldProducts) — never re-hardcoded
// here beyond the shipping constants.
import { v1 } from '@softx/contract'
import { worldCurrency } from '@softx/contract/testing'
import type { FakeCartState } from './fake-cart'

const { ok, err } = v1

/** parity with engine/src/order.ts — subtotal >= 100.00 (minor) ships free */
const FREE_SHIPPING_THRESHOLD_MINOR = 100_00
/** parity with engine/src/order.ts — flat shipping fee 9.99 in minor units */
const SHIP_COST_MINOR = 999

/** Deterministic timestamps: the fake is order-insensitive on purpose. */
const FIXED_TS = '2026-01-01T00:00:00.000Z'

/** Stored order = OrderDTO + owner (the repo-row shape); userId never enters the DTO. */
export interface StoredOrder extends v1.OrderDTO {
  userId: string
}

/** OrderDTO projection — the single choke point keeping the owner userId inside. */
export function toOrderDTO({ userId: _userId, ...dto }: StoredOrder): v1.OrderDTO {
  return dto
}

/**
 * Shared per-runner fake order state: the stored orders plus the storefront
 * order service over them. The fake ADMIN order service (fake-admin.ts) needs
 * the same list — listAllOrders reads every row and updateOrderStatus mutates
 * the status the storefront owner-read serves — so a runner composing order +
 * adminOrder services must build ONE state instance and share it, exactly
 * like `createFakeEngine().for()` does.
 */
export interface FakeOrderState {
  orders: StoredOrder[]
  orderService: v1.OrderService
}

/**
 * Fake order service. Reads the user's cart through the SHARED cart service
 * (same storage the cartService mutates), computes totals server-side with
 * the engine's pricing rule, and clears the cart in that shared state only
 * after a successful write. Reads and proof attachment enforce ownership
 * (UNAUTHORIZED for someone else's order, NOT_FOUND for an unknown id).
 */
export function createFakeOrderState(state: FakeCartState): FakeOrderState {
  const orders: StoredOrder[] = []
  let seq = 0

  const orderService: v1.OrderService = {
    async createOrder(userId, command) {
      const cart = await state.cartService.getCart({ kind: 'user', userId })
      if (!cart.ok) return err('UNAVAILABLE', 'Failed to read cart')
      const items = cart.data.cart.items
      if (items.length === 0) return err('VALIDATION', 'Cart is empty')

      // parity with engine/src/order.ts: subtotal = Σ stock price × qty
      const subtotalMinor = items.reduce(
        (n, i) => n + i.product.price.stock.amountMinor * i.quantity,
        0,
      )
      // parity with engine/src/order.ts:
      // shipping = SHIP ? (subtotal >= 100.00 ? 0 : 9.99) : 0
      const shippingMinor =
        command.deliveryMethod === 'SHIP'
          ? subtotalMinor >= FREE_SHIPPING_THRESHOLD_MINOR
            ? 0
            : SHIP_COST_MINOR
          : 0

      seq += 1
      const stored: StoredOrder = {
        userId,
        id: `ord-${seq}`,
        orderNumber: `ORD-${seq}`,
        status: 'PENDING',
        totalAmount: v1.money(subtotalMinor + shippingMinor, worldCurrency),
        shippingAddress: { ...command.shippingAddress },
        deliveryMethod: command.deliveryMethod,
        // Display fields derive from the cart's hydrated CartItemDTOs —
        // product.name/id/brand, variant.size/color and product.images[0] —
        // nothing re-hardcoded.
        items: items.map((i) => {
          const image = i.product.images[0]
          return {
            variantId: i.variantId,
            quantity: i.quantity,
            priceAtPurchase: v1.money(
              i.product.price.stock.amountMinor,
              i.product.price.stock.currency,
            ),
            productName: i.product.name,
            ...(image !== undefined ? { productImage: image } : {}),
            productId: i.product.id,
            productBrand: i.product.brand,
            variantSize: i.variant.size,
            variantColor: i.variant.color,
          }
        }),
        createdAt: FIXED_TS,
        updatedAt: FIXED_TS,
      }
      orders.push(stored)
      // Cart cleared in the SHARED state only after the order is recorded.
      await state.cartService.clearCart({ kind: 'user', userId })
      return ok(toOrderDTO(stored))
    },

    async getOrder(userId, orderId) {
      const found = orders.find((o) => o.id === orderId)
      if (!found) return err('NOT_FOUND', `Order ${orderId} not found`)
      if (found.userId !== userId) {
        return err('UNAUTHORIZED', 'Order does not belong to user')
      }
      return ok(toOrderDTO(found))
    },

    async listOrders(userId) {
      // Newest first — parity with order.repository.getUserOrders
      // (ORDER BY createdAt DESC); timestamps are fixed here, so insertion
      // order is reversed instead.
      return ok(
        orders
          .filter((o) => o.userId === userId)
          .slice()
          .reverse()
          .map(toOrderDTO),
      )
    },

    async attachPaymentProof(userId, orderId, proofUrl) {
      const found = orders.find((o) => o.id === orderId)
      if (!found) return err('NOT_FOUND', `Order ${orderId} not found`)
      if (found.userId !== userId) {
        return err('UNAUTHORIZED', 'Order does not belong to user')
      }
      found.paymentProof = proofUrl
      return ok(toOrderDTO(found))
    },
  }

  return { orders, orderService }
}

/**
 * Backwards-compatible standalone order service owning its own state — use
 * createFakeOrderState() directly when an admin service must share the orders.
 */
export function createFakeOrderService(state: FakeCartState): v1.OrderService {
  return createFakeOrderState(state).orderService
}
