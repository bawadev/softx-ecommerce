import { getSession } from '../db'
import { v4 as uuidv4 } from 'uuid'
import type { CartItem } from '../types'
import type { ProductWithVariants } from './product.repository'

export interface CartItemWithDetails extends CartItem {
  product: {
    id: string
    name: string
    brand: string
    category: string
    gender: string
    stockPrice: number
    retailPrice: number
    sku: string
    images: string[]
  }
  variant: {
    id: string
    size: string
    color: string
    stockQuantity: number
    images: string[]
  }
}

/**
 * Add item to cart or update quantity if already exists
 * Uses MERGE to prevent race condition duplicates
 */
export async function addToCart(
  userId: string,
  variantId: string,
  quantity: number = 1
): Promise<CartItem> {
  if (quantity <= 0) {
    throw new Error('Quantity must be greater than 0')
  }

  const session = getSession()
  try {
    const cartItemId = uuidv4()
    const now = new Date().toISOString()

    const result = await session.run(
      `
      MATCH (u:User {id: $userId})
      MATCH (v:ProductVariant {id: $variantId})
      MERGE (u)-[:HAS_CART_ITEM]->(c:CartItem {userId: $userId, variantId: $variantId})
      ON CREATE SET c.id = $cartItemId, c.quantity = $quantity, c.addedAt = $addedAt
      ON MATCH SET c.quantity = c.quantity + $quantity
      WITH c, v
      MERGE (c)-[:CART_ITEM_FOR]->(v)
      RETURN c {.*}
      `,
      { cartItemId, userId, variantId, quantity, addedAt: now }
    )

    return result.records[0].get('c')
  } finally {
    await session.close()
  }
}

/**
 * Remove item from cart
 */
export async function removeFromCart(userId: string, variantId: string): Promise<void> {
  const session = getSession()
  try {
    await session.run(
      `
      MATCH (u:User {id: $userId})-[r:HAS_CART_ITEM]->(c:CartItem {variantId: $variantId})
      DETACH DELETE c
      `,
      { userId, variantId }
    )
  } finally {
    await session.close()
  }
}

/**
 * Update cart item quantity
 */
export async function updateCartItemQuantity(
  userId: string,
  variantId: string,
  quantity: number
): Promise<CartItem> {
  const session = getSession()
  try {
    if (quantity <= 0) {
      await removeFromCart(userId, variantId)
      throw new Error('Quantity must be greater than 0')
    }

    const result = await session.run(
      `
      MATCH (u:User {id: $userId})-[r:HAS_CART_ITEM]->(c:CartItem {variantId: $variantId})
      SET c.quantity = $quantity
      RETURN c {.*}
      `,
      { userId, variantId, quantity }
    )

    return result.records[0]?.get('c')
  } finally {
    await session.close()
  }
}

/**
 * Get all cart items for a user with product and variant details
 */
export async function getCartItems(userId: string): Promise<CartItemWithDetails[]> {
  const session = getSession()
  try {
    const result = await session.run(
      `
      MATCH (u:User {id: $userId})-[:HAS_CART_ITEM]->(c:CartItem)-[:CART_ITEM_FOR]->(v:ProductVariant)-[:VARIANT_OF]->(p:Product)
      RETURN c {.*} as cartItem,
             p {.id, .name, .brand, .category, .gender, .stockPrice, .retailPrice, .sku, .images} as product,
             v {.*} as variant
      ORDER BY c.addedAt DESC
      `,
      { userId }
    )

    return result.records.map((record) => {
      const cartItem = record.get('cartItem')
      const product = record.get('product')
      const variant = record.get('variant')

      return {
        ...cartItem,
        product,
        variant,
      }
    })
  } finally {
    await session.close()
  }
}

/**
 * Get cart item count for a user
 */
export async function getCartCount(userId: string): Promise<number> {
  const session = getSession()
  try {
    const result = await session.run(
      `
      MATCH (u:User {id: $userId})-[:HAS_CART_ITEM]->(c:CartItem)
      RETURN sum(c.quantity) as count
      `,
      { userId }
    )

    const count = result.records[0]?.get('count')
    if (!count) return 0
    // Handle Neo4j Integer type
    return typeof count === 'number' ? count : count.toNumber()
  } finally {
    await session.close()
  }
}

/**
 * Clear all items from cart
 */
export async function clearCart(userId: string): Promise<void> {
  const session = getSession()
  try {
    await session.run(
      `
      MATCH (u:User {id: $userId})-[r:HAS_CART_ITEM]->(c:CartItem)
      DETACH DELETE c
      `,
      { userId }
    )
  } finally {
    await session.close()
  }
}

/**
 * Get cart total price
 */
export async function getCartTotal(userId: string): Promise<number> {
  const items = await getCartItems(userId)
  return items.reduce((total, item) => {
    return total + item.product.stockPrice * item.quantity
  }, 0)
}
