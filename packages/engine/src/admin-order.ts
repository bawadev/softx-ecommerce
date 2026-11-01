import { v1 } from '@softx/contract'
import type { EngineConfig, TenantRef } from './engine'
import { toOrderDTO } from './mappers/order.mapper'
import * as orderRepo from './repositories/order.repository'

const { ok, err } = v1

/**
 * AdminOrderService v1 (Phase 5 Task 3) — the admin order surface over
 * order.repository.
 *
 * Authorization: same guard-first discipline as AdminCatalogService — the
 * per-call ActorRef is checked as each method's FIRST statement, BEFORE any
 * repository work, so a non-admin against an unknown order id answers
 * UNAUTHORIZED ('Admin access required'), never UNAVAILABLE/NOT_FOUND. The
 * optional `_actor` captured by `engine.for(tenant, actor)` is deliberately
 * not consulted; the per-call actor is authoritative.
 *
 * `listAllOrders` maps the repo's hydrated `OrderWithItems` rows (the raw
 * shape getAdminOrdersAction returned) onto `v1.OrderDTO` INCLUDING items,
 * per the Task 1 pin — the mapper renders placeholder display fields for
 * items whose variant/product links were severed by admin deletes.
 *
 * `updateOrderStatus` forwards to the repo and returns `Result<null>`; the
 * repo has no not-found signal (it dereferences the empty result set), so a
 * missing order surfaces as the action's 'Failed to update order status'
 * UNAVAILABLE.
 */
export function createAdminOrderService(
  config: EngineConfig,
  _tenant: TenantRef,
  _actor?: v1.ActorRef
): v1.AdminOrderService {
  const currency = config.defaultCurrency ?? 'LKR'
  const db = config.neo4j.database

  return {
    async listAllOrders(actor) {
      if (actor?.kind !== 'admin') return err('UNAUTHORIZED', 'Admin access required')
      try {
        const orders = await orderRepo.getAllOrders(db)
        return ok(orders.map((o) => toOrderDTO(o, currency)))
      } catch (e) {
        return err('UNAVAILABLE', 'Failed to fetch orders', { cause: String(e) })
      }
    },

    async updateOrderStatus(actor, orderId, status) {
      if (actor?.kind !== 'admin') return err('UNAUTHORIZED', 'Admin access required')
      try {
        await orderRepo.updateOrderStatus(orderId, status, db)
        return ok(null)
      } catch (e) {
        return err('UNAVAILABLE', 'Failed to update order status', { cause: String(e) })
      }
    },
  }
}
