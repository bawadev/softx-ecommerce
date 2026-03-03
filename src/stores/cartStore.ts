import { create } from 'zustand'
import type { CartItemWithDetails } from '@/lib/repositories/cart.repository'
import {
  addToCartAction,
  removeFromCartAction,
  updateCartItemAction,
  getCartItemsAction,
  clearCartAction,
} from '@/app/actions/cart'

interface CartStore {
  // State
  items: CartItemWithDetails[]
  itemCount: number
  total: number

  // Loading states
  isAdding: boolean
  isUpdating: boolean
  isRemoving: boolean
  isLoading: boolean

  // Actions
  loadCart: () => Promise<void>
  addToCart: (variantId: string, quantity?: number) => Promise<boolean>
  updateQuantity: (variantId: string, quantity: number) => Promise<boolean>
  removeFromCart: (variantId: string) => Promise<boolean>
  clearCart: () => Promise<boolean>
}

export const useCartStore = create<CartStore>((set, get) => ({
  // Initial state
  items: [],
  itemCount: 0,
  total: 0,
  isAdding: false,
  isUpdating: false,
  isRemoving: false,
  isLoading: false,

  // Load cart from server
  loadCart: async () => {
    set({ isLoading: true })
    try {
      const result = await getCartItemsAction()
      if (result.success && result.data) {
        set({
          items: result.data.items,
          itemCount: result.data.itemCount,
          total: result.data.total,
        })
      }
    } catch (error) {
      console.error('Failed to load cart:', error)
    } finally {
      set({ isLoading: false })
    }
  },

  // Add item to cart with optimistic update
  addToCart: async (variantId: string, quantity = 1) => {
    set({ isAdding: true })

    // Optimistic update - we'll update the actual count after server response
    // For now, we just show loading state

    try {
      const result = await addToCartAction(variantId, quantity)

      if (result.success) {
        // Reload cart to get updated state
        const cartResult = await getCartItemsAction()
        if (cartResult.success && cartResult.data) {
          set({
            items: cartResult.data.items,
            itemCount: cartResult.data.itemCount,
            total: cartResult.data.total,
          })
        }
        return true
      }
      return false
    } catch (error) {
      console.error('Failed to add to cart:', error)
      return false
    } finally {
      set({ isAdding: false })
    }
  },

  // Update item quantity with optimistic update
  updateQuantity: async (variantId: string, quantity: number) => {
    set({ isUpdating: true })

    // Optimistic update - update local state immediately
    const currentItems = get().items
    const optimisticItems = currentItems.map(item =>
      item.variantId === variantId
        ? { ...item, quantity }
        : item
    )

    // Recalculate totals optimistically
    const optimisticTotal = optimisticItems.reduce(
      (sum, item) => sum + item.product.stockPrice * quantity,
      0
    )

    set({
      items: optimisticItems,
      total: optimisticTotal,
    })

    try {
      const result = await updateCartItemAction(variantId, quantity)

      if (result.success) {
        // Reload to get server-confirmed state
        const cartResult = await getCartItemsAction()
        if (cartResult.success && cartResult.data) {
          set({
            items: cartResult.data.items,
            itemCount: cartResult.data.itemCount,
            total: cartResult.data.total,
          })
        }
        return true
      } else {
        // Revert optimistic update on failure
        set({ items: currentItems, total: get().total })
        return false
      }
    } catch (error) {
      console.error('Failed to update cart:', error)
      // Revert optimistic update on error
      set({ items: currentItems, total: get().total })
      return false
    } finally {
      set({ isUpdating: false })
    }
  },

  // Remove item from cart with optimistic update
  removeFromCart: async (variantId: string) => {
    set({ isRemoving: true })

    // Optimistic update - remove item immediately
    const currentItems = get().items
    const optimisticItems = currentItems.filter(item => item.variantId !== variantId)

    // Recalculate totals optimistically
    const optimisticTotal = optimisticItems.reduce(
      (sum, item) => sum + item.product.stockPrice * item.quantity,
      0
    )

    set({
      items: optimisticItems,
      itemCount: optimisticItems.reduce((sum, item) => sum + item.quantity, 0),
      total: optimisticTotal,
    })

    try {
      const result = await removeFromCartAction(variantId)

      if (result.success) {
        // Optimistic update was correct, keep it
        return true
      } else {
        // Revert optimistic update on failure
        set({ items: currentItems, itemCount: get().itemCount, total: get().total })
        return false
      }
    } catch (error) {
      console.error('Failed to remove from cart:', error)
      // Revert optimistic update on error
      set({ items: currentItems, itemCount: get().itemCount, total: get().total })
      return false
    } finally {
      set({ isRemoving: false })
    }
  },

  // Clear entire cart
  clearCart: async () => {
    set({ isLoading: true })

    try {
      const result = await clearCartAction()

      if (result.success) {
        set({
          items: [],
          itemCount: 0,
          total: 0,
        })
        return true
      }
      return false
    } catch (error) {
      console.error('Failed to clear cart:', error)
      return false
    } finally {
      set({ isLoading: false })
    }
  },
}))
