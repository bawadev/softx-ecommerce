'use server'

import { getCurrentUserId } from '@/lib/auth'
import { getCartService } from '@/lib/engine'
import { getGuestCart, saveGuestCart, clearGuestCart } from '@/lib/guest-cart'
import type { ActionResponse } from '@softx/engine'
import type { v1 } from '@softx/contract'

async function currentOwner(): Promise<v1.CartOwner> {
  const userId = await getCurrentUserId()
  if (userId) return { kind: 'user', userId }
  // Legacy cookies may hold quantity <= 0 lines — the contract requires positive ints.
  const items = (await getGuestCart()).filter((l) => l.quantity >= 1)
  return { kind: 'guest', items }
}

/** Persist normalized guest lines back to the cookie. Safe only in action context — same rule as today. */
async function persistGuest(m: v1.CartMutation): Promise<void> {
  if (m.guestItems) {
    try {
      await saveGuestCart(m.guestItems)
    } catch {
      // Server Component render context — ignore; the next client-triggered call heals.
    }
  }
}

/** The projection payload every mutation returns so the store never refetches. */
type CartProjection = { items: v1.CartItemDTO[]; total: v1.Money; itemCount: number }

function projectionOf(m: v1.CartMutation): CartProjection {
  return { items: m.cart.items, total: m.cart.total, itemCount: m.cart.itemCount }
}

export async function addToCartAction(variantId: string, quantity = 1): Promise<ActionResponse<CartProjection>> {
  const r = await getCartService().addItem(await currentOwner(), variantId, quantity)
  if (!r.ok) return { success: false, message: r.error.message }
  await persistGuest(r.data)
  return { success: true, message: 'Item added to cart', data: projectionOf(r.data) }
}

export async function removeFromCartAction(variantId: string): Promise<ActionResponse<CartProjection>> {
  const r = await getCartService().removeItem(await currentOwner(), variantId)
  if (!r.ok) return { success: false, message: r.error.message }
  await persistGuest(r.data)
  return { success: true, message: 'Item removed from cart', data: projectionOf(r.data) }
}

export async function updateCartItemAction(variantId: string, quantity: number): Promise<ActionResponse<CartProjection>> {
  if (quantity < 1) return { success: false, message: 'Quantity must be at least 1' }
  const r = await getCartService().updateItem(await currentOwner(), variantId, quantity)
  if (!r.ok) return { success: false, message: r.error.message }
  await persistGuest(r.data)
  return { success: true, message: 'Cart updated', data: projectionOf(r.data) }
}

export async function getCartItemsAction(): Promise<
  ActionResponse<{ items: v1.CartItemDTO[]; total: v1.Money; itemCount: number }>
> {
  const r = await getCartService().getCart(await currentOwner())
  if (!r.ok) return { success: false, message: r.error.message }
  await persistGuest(r.data) // heals the cookie during reads too, when allowed
  return { success: true, data: { items: r.data.cart.items, total: r.data.cart.total, itemCount: r.data.cart.itemCount } }
}

export async function getCartCountAction(): Promise<ActionResponse<{ count: number }>> {
  const r = await getCartService().getCart(await currentOwner())
  if (!r.ok) return { success: false, message: r.error.message }
  await persistGuest(r.data)
  return { success: true, data: { count: r.data.cart.itemCount } }
}

export async function clearCartAction(): Promise<ActionResponse> {
  const r = await getCartService().clearCart(await currentOwner())
  if (!r.ok) return { success: false, message: r.error.message }
  if ((await getCurrentUserId()) == null) await clearGuestCart().catch(() => {})
  return { success: true, message: 'Cart cleared' }
}
