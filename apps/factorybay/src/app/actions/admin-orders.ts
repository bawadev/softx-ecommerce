'use server'

import type { ActionResponse, OrderStatus } from '@softx/engine'
import type { v1 } from '@softx/contract'
import { getAdminOrder, currentActor } from '@/lib/engine'

/**
 * Get all orders for admin view
 */
export async function getAdminOrdersAction(): Promise<
  ActionResponse<{ orders: v1.OrderDTO[] }>
> {
  try {
    const r = await getAdminOrder().listAllOrders(await currentActor())

    if (!r.ok) {
      return {
        success: false,
        message: r.error.code === 'UNAUTHORIZED' ? 'Unauthorized' : r.error.message,
      }
    }

    return {
      success: true,
      data: { orders: r.data },
    }
  } catch (error) {
    console.error('Get admin orders error:', error)
    return {
      success: false,
      message: 'Failed to fetch orders',
    }
  }
}

/**
 * Update order status
 */
export async function updateAdminOrderStatusAction(
  orderId: string,
  status: OrderStatus
): Promise<ActionResponse<null>> {
  try {
    const r = await getAdminOrder().updateOrderStatus(await currentActor(), orderId, status)

    if (!r.ok) {
      return {
        success: false,
        message: r.error.code === 'UNAUTHORIZED' ? 'Unauthorized' : r.error.message,
      }
    }

    return {
      success: true,
      message: 'Order status updated successfully',
    }
  } catch (error) {
    console.error('Update order status error:', error)
    return {
      success: false,
      message: 'Failed to update order status',
    }
  }
}
