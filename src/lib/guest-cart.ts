/**
 * Guest cart management using cookies
 * Stores cart items in a cookie for non-authenticated users
 */

import { cookies } from 'next/headers'
import { v4 as uuidv4 } from 'uuid'

export interface GuestCartItem {
  variantId: string
  quantity: number
}

const GUEST_CART_COOKIE = 'guest_cart'
const GUEST_SESSION_COOKIE = 'guest_session_id'
const CART_MAX_AGE = 60 * 60 * 24 * 30 // 30 days

/**
 * Get or create guest session ID
 */
export async function getGuestSessionId(): Promise<string> {
  const cookieStore = await cookies()
  let sessionId = cookieStore.get(GUEST_SESSION_COOKIE)?.value

  if (!sessionId) {
    sessionId = uuidv4()
    cookieStore.set(GUEST_SESSION_COOKIE, sessionId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: CART_MAX_AGE,
    })
  }

  return sessionId
}

/**
 * Get guest cart items from cookie
 */
export async function getGuestCart(): Promise<GuestCartItem[]> {
  const cookieStore = await cookies()
  const cartCookie = cookieStore.get(GUEST_CART_COOKIE)?.value

  if (!cartCookie) {
    return []
  }

  try {
    return JSON.parse(cartCookie)
  } catch {
    return []
  }
}

/**
 * Save guest cart to cookie
 */
export async function saveGuestCart(items: GuestCartItem[]): Promise<void> {
  const cookieStore = await cookies()

  cookieStore.set(GUEST_CART_COOKIE, JSON.stringify(items), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: CART_MAX_AGE,
  })
}

/**
 * Add item to guest cart
 */
export async function addToGuestCart(variantId: string, quantity: number): Promise<void> {
  const cart = await getGuestCart()
  const existingItem = cart.find(item => item.variantId === variantId)

  if (existingItem) {
    existingItem.quantity += quantity
  } else {
    cart.push({ variantId, quantity })
  }

  await saveGuestCart(cart)
}

/**
 * Remove item from guest cart
 */
export async function removeFromGuestCart(variantId: string): Promise<void> {
  const cart = await getGuestCart()
  const updatedCart = cart.filter(item => item.variantId !== variantId)
  await saveGuestCart(updatedCart)
}

/**
 * Update guest cart item quantity
 */
export async function updateGuestCartQuantity(variantId: string, quantity: number): Promise<void> {
  const cart = await getGuestCart()
  const item = cart.find(item => item.variantId === variantId)

  if (item) {
    item.quantity = quantity
    await saveGuestCart(cart)
  }
}

/**
 * Clear guest cart
 */
export async function clearGuestCart(): Promise<void> {
  await saveGuestCart([])
}

