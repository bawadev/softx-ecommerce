'use server'

import { getCurrentUserId, isAdmin } from '@/lib/auth'
import { getOrderService } from '@/lib/engine'
import { updateOrderStatus } from '@softx/engine'
import type { OrderStatus, ActionResponse } from '@softx/engine'
import type { v1 } from '@softx/contract'

/**
 * Create order from current cart — the engine computes totals server-side
 * (never trusts the client), writes the order, and clears the cart.
 */
export async function createOrderAction(
  shippingAddress: v1.ShippingAddressDTO,
  deliveryMethod: v1.OrderDTO['deliveryMethod'],
  email?: string
): Promise<ActionResponse<{ orderId: string; orderNumber: string }>> {
  try {
    const userId = await getCurrentUserId()

    if (!userId) {
      return {
        success: false,
        message: 'You must be logged in to place an order',
      }
    }

    const r = await getOrderService().createOrder(userId, {
      shippingAddress,
      deliveryMethod,
      ...(email ? { email } : {}),
    })

    if (!r.ok) {
      return {
        success: false,
        // Empty cart arrives as VALIDATION from the service; keep today's
        // friendly checkout message for it.
        message: r.error.code === 'VALIDATION' ? 'Your cart is empty' : r.error.message,
      }
    }

    return {
      success: true,
      message: 'Order placed successfully!',
      data: {
        orderId: r.data.id,
        orderNumber: r.data.orderNumber,
      },
    }
  } catch (error) {
    console.error('Create order error:', error)
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Failed to create order',
    }
  }
}

/**
 * Get order by ID — the service enforces ownership (UNAUTHORIZED for
 * someone else's order, NOT_FOUND for an unknown id).
 */
export async function getOrderAction(
  orderId: string
): Promise<ActionResponse<{ order: v1.OrderDTO }>> {
  try {
    const userId = await getCurrentUserId()

    if (!userId) {
      return {
        success: false,
        message: 'You must be logged in',
      }
    }

    const r = await getOrderService().getOrder(userId, orderId)

    if (!r.ok) {
      return {
        success: false,
        message:
          r.error.code === 'UNAUTHORIZED'
            ? 'Unauthorized'
            : r.error.code === 'NOT_FOUND'
              ? 'Order not found'
              : r.error.message,
      }
    }

    return {
      success: true,
      data: { order: r.data },
    }
  } catch (error) {
    console.error('Get order error:', error)
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Failed to get order',
    }
  }
}

/**
 * Get all orders for current user (newest first — service/repository order)
 */
export async function getUserOrdersAction(): Promise<
  ActionResponse<{ orders: v1.OrderDTO[]; count: number }>
> {
  try {
    const userId = await getCurrentUserId()

    if (!userId) {
      return {
        success: false,
        message: 'You must be logged in',
      }
    }

    const r = await getOrderService().listOrders(userId)

    if (!r.ok) {
      return {
        success: false,
        message: r.error.code === 'UNAUTHORIZED' ? 'Unauthorized' : r.error.message,
      }
    }

    return {
      success: true,
      data: { orders: r.data, count: r.data.length },
    }
  } catch (error) {
    console.error('Get user orders error:', error)
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Failed to get orders',
    }
  }
}

/**
 * Update order status (admin only - TODO: add admin check)
 */
export async function updateOrderStatusAction(
  orderId: string,
  status: OrderStatus
): Promise<ActionResponse> {
  try {
    const userId = await getCurrentUserId()

    if (!userId) {
      return {
        success: false,
        message: 'You must be logged in',
      }
    }

    const adminAccess = await isAdmin()
    if (!adminAccess) {
      return {
        success: false,
        message: 'Unauthorized: Admin access required',
      }
    }

    await updateOrderStatus(orderId, status)

    return {
      success: true,
      message: 'Order status updated',
    }
  } catch (error) {
    console.error('Update order status error:', error)
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Failed to update order status',
    }
  }
}
