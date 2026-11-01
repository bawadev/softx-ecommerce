import type { Result } from '../core/result'
import type { OrderDTO, CreateOrderCommand } from './order.dto'

export interface OrderService {
  /** Creates an order from the user's cart (server-side totals), then clears the cart. Empty cart → VALIDATION. */
  createOrder(userId: string, command: CreateOrderCommand): Promise<Result<OrderDTO>>
  /** Owner-only read; someone else's order → UNAUTHORIZED; unknown id → NOT_FOUND. */
  getOrder(userId: string, orderId: string): Promise<Result<OrderDTO>>
  listOrders(userId: string): Promise<Result<OrderDTO[]>>
  /** Records the MinIO URL of an uploaded payment proof (upload itself is app-side). */
  attachPaymentProof(userId: string, orderId: string, proofUrl: string): Promise<Result<OrderDTO>>
}
