'use server'

import { getCurrentUserId } from '@/lib/auth'
import {
  addToCart,
  removeFromCart,
  updateCartItemQuantity,
  getCartItems,
  getCartCount,
  clearCart,
  getCartTotal,
  type CartItemWithDetails,
} from '@/lib/repositories/cart.repository'
import {
  addToGuestCart,
  removeFromGuestCart,
  updateGuestCartQuantity,
  getGuestCart,
  saveGuestCart,
  clearGuestCart,
  type GuestCartItem,
} from '@/lib/guest-cart'
import { getVariantWithProduct } from '@/lib/repositories/product.repository'
import type { ActionResponse } from '@/lib/types'

/**
 * Get guest cart items with full details.
 * Also self-heals the cookie: any variant that no longer exists in the DB
 * (e.g. was removed by a reseed) gets pruned so the nav badge and the cart
 * page stay in agreement.
 */
async function getGuestCartWithDetails(): Promise<CartItemWithDetails[]> {
  const guestCart = await getGuestCart()
  const items: CartItemWithDetails[] = []
  const validEntries: GuestCartItem[] = []

  for (const item of guestCart) {
    try {
      const data = await getVariantWithProduct(item.variantId)
      if (data) {
        items.push({
          id: item.variantId,
          userId: 'guest',
          variantId: item.variantId,
          quantity: item.quantity,
          addedAt: new Date().toISOString(),
          product: data.product,
          variant: data.variant,
        })
        validEntries.push(item)
      }
    } catch (error) {
      console.error(`Failed to get variant details for ${item.variantId}:`, error)
    }
  }

  if (validEntries.length !== guestCart.length) {
    try {
      await saveGuestCart(validEntries)
    } catch {
      // Cookie writes are only allowed in Server Action / Route Handler
      // contexts. When this runs during a Server Component render the write
      // is rejected — ignore it; the next client-triggered call will heal.
    }
  }

  return items
}

function sumGuestItems(items: CartItemWithDetails[]): number {
  return items.reduce((sum, item) => sum + item.quantity, 0)
}

/**
 * Calculate total for guest cart
 */
function calculateGuestCartTotal(items: CartItemWithDetails[]): number {
  return items.reduce((sum, item) => {
    return sum + item.product.stockPrice * item.quantity
  }, 0)
}

/**
 * Add item to cart (supports both authenticated and guest users)
 */
export async function addToCartAction(
  variantId: string,
  quantity: number = 1
): Promise<ActionResponse> {
  try {
    if (quantity < 1) {
      return {
        success: false,
        message: 'Quantity must be at least 1',
      }
    }

    const userId = await getCurrentUserId()

    if (userId) {
      // Authenticated user - use database cart
      await addToCart(userId, variantId, quantity)
    } else {
      // Guest user - use cookie cart
      await addToGuestCart(variantId, quantity)
    }

    return {
      success: true,
      message: 'Item added to cart',
    }
  } catch (error) {
    console.error('Add to cart error:', error)
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Failed to add item to cart',
    }
  }
}

/**
 * Remove item from cart (supports both authenticated and guest users)
 */
export async function removeFromCartAction(variantId: string): Promise<ActionResponse> {
  try {
    const userId = await getCurrentUserId()

    if (userId) {
      // Authenticated user
      await removeFromCart(userId, variantId)
    } else {
      // Guest user
      await removeFromGuestCart(variantId)
    }

    return {
      success: true,
      message: 'Item removed from cart',
    }
  } catch (error) {
    console.error('Remove from cart error:', error)
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Failed to remove item',
    }
  }
}

/**
 * Update cart item quantity (supports both authenticated and guest users)
 */
export async function updateCartItemAction(
  variantId: string,
  quantity: number
): Promise<ActionResponse> {
  try {
    if (quantity < 1) {
      return {
        success: false,
        message: 'Quantity must be at least 1',
      }
    }

    const userId = await getCurrentUserId()

    if (userId) {
      // Authenticated user
      await updateCartItemQuantity(userId, variantId, quantity)
    } else {
      // Guest user
      await updateGuestCartQuantity(variantId, quantity)
    }

    return {
      success: true,
      message: 'Cart updated',
    }
  } catch (error) {
    console.error('Update cart error:', error)
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Failed to update cart',
    }
  }
}

/**
 * Get all cart items (supports both authenticated and guest users)
 */
export async function getCartItemsAction(): Promise<
  ActionResponse<{ items: CartItemWithDetails[]; total: number; itemCount: number }>
> {
  try {
    const userId = await getCurrentUserId()

    let items: CartItemWithDetails[]
    let total: number
    let itemCount: number

    if (userId) {
      // Authenticated user
      items = await getCartItems(userId)
      total = await getCartTotal(userId)
      itemCount = await getCartCount(userId)
    } else {
      // Guest user
      items = await getGuestCartWithDetails()
      total = calculateGuestCartTotal(items)
      itemCount = sumGuestItems(items)
    }

    return {
      success: true,
      data: { items, total, itemCount },
    }
  } catch (error) {
    console.error('Get cart items error:', error)
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Failed to get cart items',
    }
  }
}

/**
 * Get cart item count (supports both authenticated and guest users)
 */
export async function getCartCountAction(): Promise<ActionResponse<{ count: number }>> {
  try {
    const userId = await getCurrentUserId()

    let count: number

    if (userId) {
      // Authenticated user
      count = await getCartCount(userId)
    } else {
      // Guest user — validate entries so orphaned variants don't inflate the badge
      const validItems = await getGuestCartWithDetails()
      count = sumGuestItems(validItems)
    }

    return {
      success: true,
      data: { count },
    }
  } catch (error) {
    console.error('Get cart count error:', error)
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Failed to get cart count',
    }
  }
}

/**
 * Clear cart (supports both authenticated and guest users)
 */
export async function clearCartAction(): Promise<ActionResponse> {
  try {
    const userId = await getCurrentUserId()

    if (userId) {
      // Authenticated user
      await clearCart(userId)
    } else {
      // Guest user
      await clearGuestCart()
    }

    return {
      success: true,
      message: 'Cart cleared',
    }
  } catch (error) {
    console.error('Clear cart error:', error)
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Failed to clear cart',
    }
  }
}
