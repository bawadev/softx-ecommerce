import { create } from 'zustand'
import type { v1 } from '@softx/contract'
import {
  addToCartAction,
  removeFromCartAction,
  updateCartItemAction,
  getCartItemsAction,
  clearCartAction,
} from '@/app/actions/cart'

interface CartStore {
  // State (CartService projection)
  items: v1.CartItemDTO[]
  itemCount: number
  total: v1.Money

  // True once a server projection has landed here (loadCart or a mutation).
  // LKD-31: surfaces let pages render their server-fetched props until this
  // flips, instead of flashing the empty initial store.
  hasLoaded: boolean

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

const EMPTY_MONEY: v1.Money = { amountMinor: 0, currency: 'LKR' }

/** Optimistic stock-price total in minor units over a projected item list. */
function stockTotalMinor(items: v1.CartItemDTO[]): number {
  return items.reduce((sum, item) => sum + item.product.price.stock.amountMinor * item.quantity, 0)
}

function optimisticTotal(items: v1.CartItemDTO[], currency: string): v1.Money {
  return { amountMinor: stockTotalMinor(items), currency }
}

/** Set the full projection returned by the mutation actions — never refetch. */
function setProjection(
  set: (partial: Partial<CartStore>) => void,
  data: { items: v1.CartItemDTO[]; total: v1.Money; itemCount: number }
) {
  set({ items: data.items, itemCount: data.itemCount, total: data.total, hasLoaded: true })
}

export const useCartStore = create<CartStore>((set, get) => ({
  // Initial state
  items: [],
  itemCount: 0,
  total: EMPTY_MONEY,
  hasLoaded: false,
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
        setProjection(set, result.data)
      }
    } catch (error) {
      console.error('Failed to load cart:', error)
    } finally {
      set({ isLoading: false })
    }
  },

  // Add item to cart — server projection applied on success, no refetch
  addToCart: async (variantId: string, quantity = 1) => {
    set({ isAdding: true })

    try {
      const result = await addToCartAction(variantId, quantity)

      if (result.success && result.data) {
        setProjection(set, result.data)
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

  // Update item quantity with optimistic pre-update, reconciled from the projection
  updateQuantity: async (variantId: string, quantity: number) => {
    set({ isUpdating: true })

    // Optimistic update - update local state immediately
    const snapshot = { items: get().items, itemCount: get().itemCount, total: get().total }
    const optimisticItems = snapshot.items.map(item =>
      item.variantId === variantId
        ? { ...item, quantity }
        : item
    )

    set({
      items: optimisticItems,
      itemCount: optimisticItems.reduce((sum, item) => sum + item.quantity, 0),
      total: optimisticTotal(optimisticItems, snapshot.total.currency),
    })

    try {
      const result = await updateCartItemAction(variantId, quantity)

      if (result.success && result.data) {
        // Server projection is authoritative — reconcile from it
        setProjection(set, result.data)
        return true
      }
      // Revert optimistic update on failure
      set(snapshot)
      return false
    } catch (error) {
      console.error('Failed to update cart:', error)
      set(snapshot)
      return false
    } finally {
      set({ isUpdating: false })
    }
  },

  // Remove item from cart with optimistic pre-update, reconciled from the projection
  removeFromCart: async (variantId: string) => {
    set({ isRemoving: true })

    // Optimistic update - remove item immediately
    const snapshot = { items: get().items, itemCount: get().itemCount, total: get().total }
    const optimisticItems = snapshot.items.filter(item => item.variantId !== variantId)

    set({
      items: optimisticItems,
      itemCount: optimisticItems.reduce((sum, item) => sum + item.quantity, 0),
      total: optimisticTotal(optimisticItems, snapshot.total.currency),
    })

    try {
      const result = await removeFromCartAction(variantId)

      if (result.success && result.data) {
        // Server projection is authoritative — reconcile from it
        setProjection(set, result.data)
        return true
      }
      // Revert optimistic update on failure
      set(snapshot)
      return false
    } catch (error) {
      console.error('Failed to remove from cart:', error)
      set(snapshot)
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
          total: EMPTY_MONEY,
          hasLoaded: true,
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
