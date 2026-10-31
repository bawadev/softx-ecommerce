'use server'

import { isAdmin } from '@/lib/auth'
import {
  getAllOrders,
  updateOrderStatus,
  type OrderWithItems,
} from '@/lib/repositories/order.repository'
import type { ActionResponse, OrderStatus } from '@/lib/types'

/**
 * Get all orders for admin view
 */
export async function getAdminOrdersAction(): Promise<
  ActionResponse<{ orders: OrderWithItems[] }>
> {
  const adminAccess = await isAdmin()

  if (!adminAccess) {
    return {
      success: false,
      message: 'Unauthorized',
    }
  }

  try {
    const orders = await getAllOrders()

    return {
      success: true,
      data: { orders },
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
  const adminAccess = await isAdmin()

  if (!adminAccess) {
    return {
      success: false,
      message: 'Unauthorized',
    }
  }

  try {
    await updateOrderStatus(orderId, status)

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
