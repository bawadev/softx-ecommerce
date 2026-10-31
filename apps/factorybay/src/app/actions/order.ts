'use server'

import { getCurrentUserId, isAdmin } from '@/lib/auth'
import {
  createOrder,
  getOrderById,
  getUserOrders,
  updateOrderStatus,
  getUserOrderCount,
  type OrderWithItems,
  type CreateOrderInput,
} from '@/lib/repositories/order.repository'
import { getCartItems, clearCart } from '@/lib/repositories/cart.repository'
import type { OrderStatus, ShippingAddress, DeliveryMethod, ActionResponse } from '@/lib/types'

/**
 * Create order from current cart
 */
export async function createOrderAction(
  shippingAddress: ShippingAddress,
  deliveryMethod: DeliveryMethod,
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

    // Get cart items
    const cartItems = await getCartItems(userId)

    if (cartItems.length === 0) {
      return {
        success: false,
        message: 'Your cart is empty',
      }
    }

    // Calculate total
    const subtotal = cartItems.reduce((total, item) => {
      return total + item.product.stockPrice * item.quantity
    }, 0)

    // Shipping cost only applies if delivery method is SHIP
    const shipping = deliveryMethod === 'SHIP' ? (subtotal >= 100 ? 0 : 9.99) : 0
    const totalAmount = subtotal + shipping

    // Prepare order items
    const orderItems = cartItems.map((item) => ({
      variantId: item.variantId,
      quantity: item.quantity,
      priceAtPurchase: item.product.stockPrice,
    }))

    // Create order
    const order = await createOrder({
      userId,
      items: orderItems,
      shippingAddress,
      deliveryMethod,
      totalAmount,
    })

    // Clear cart after successful order
    await clearCart(userId)

    return {
      success: true,
      message: 'Order placed successfully!',
      data: {
        orderId: order.id,
        orderNumber: order.orderNumber,
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
 * Get order by ID
 */
export async function getOrderAction(
  orderId: string
): Promise<ActionResponse<{ order: OrderWithItems }>> {
  try {
    const userId = await getCurrentUserId()

    if (!userId) {
      return {
        success: false,
        message: 'You must be logged in',
      }
    }

    const order = await getOrderById(orderId)

    if (!order) {
      return {
        success: false,
        message: 'Order not found',
      }
    }

    // Verify the order belongs to the user
    if (order.userId !== userId) {
      return {
        success: false,
        message: 'Unauthorized',
      }
    }

    return {
      success: true,
      data: { order },
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
 * Get all orders for current user
 */
export async function getUserOrdersAction(): Promise<
  ActionResponse<{ orders: OrderWithItems[]; count: number }>
> {
  try {
    const userId = await getCurrentUserId()

    if (!userId) {
      return {
        success: false,
        message: 'You must be logged in',
      }
    }

    const orders = await getUserOrders(userId)
    const count = await getUserOrderCount(userId)

    return {
      success: true,
      data: { orders, count },
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
