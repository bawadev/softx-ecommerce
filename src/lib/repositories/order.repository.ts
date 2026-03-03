import { getSession } from '../db'
import { v4 as uuidv4 } from 'uuid'
import type { Order, OrderItem, OrderStatus, ShippingAddress, DeliveryMethod } from '../types'

export interface OrderWithItems extends Order {
  items: (OrderItem & {
    product: {
      id: string
      name: string
      brand: string
      sku: string
      images: string[]
    }
    variant: {
      id: string
      size: string
      color: string
      images: string[]
    }
  })[]
}

export interface CreateOrderInput {
  userId: string
  items: {
    variantId: string
    quantity: number
    priceAtPurchase: number
  }[]
  shippingAddress: ShippingAddress
  deliveryMethod: DeliveryMethod
  totalAmount: number
}

/**
 * Create a new order
 */
export async function createOrder(input: CreateOrderInput): Promise<Order> {
  if (input.items.length === 0) {
    throw new Error('Order must contain at least one item')
  }
  if (input.totalAmount <= 0) {
    throw new Error('Total amount must be greater than 0')
  }

  const session = getSession()
  try {
    const orderId = uuidv4()
    const orderNumber = `FB-${Date.now()}`
    const now = new Date().toISOString()

    // Create the order node
    const orderResult = await session.run(
      `
      MATCH (u:User {id: $userId})
      CREATE (o:Order {
        id: $orderId,
        orderNumber: $orderNumber,
        userId: $userId,
        status: $status,
        totalAmount: $totalAmount,
        shippingAddress: $shippingAddress,
        deliveryMethod: $deliveryMethod,
        createdAt: $createdAt,
        updatedAt: $createdAt
      })
      CREATE (u)-[:PLACED_ORDER]->(o)
      RETURN o {.*}
      `,
      {
        orderId,
        orderNumber,
        userId: input.userId,
        status: 'PENDING' as OrderStatus,
        totalAmount: input.totalAmount,
        shippingAddress: JSON.stringify(input.shippingAddress),
        deliveryMethod: input.deliveryMethod,
        createdAt: now,
      }
    )

    const order = orderResult.records[0].get('o')

    // Create order items
    for (const item of input.items) {
      const itemId = uuidv4()
      await session.run(
        `
        MATCH (o:Order {id: $orderId})
        MATCH (v:ProductVariant {id: $variantId})
        CREATE (oi:OrderItem {
          id: $itemId,
          orderId: $orderId,
          variantId: $variantId,
          quantity: $quantity,
          priceAtPurchase: $priceAtPurchase
        })
        CREATE (o)-[:HAS_ITEM]->(oi)
        CREATE (oi)-[:ITEM_OF_VARIANT]->(v)
        `,
        {
          orderId,
          itemId,
          variantId: item.variantId,
          quantity: item.quantity,
          priceAtPurchase: item.priceAtPurchase,
        }
      )
    }

    // Parse shippingAddress back from JSON
    return {
      ...order,
      shippingAddress: JSON.parse(order.shippingAddress),
    }
  } finally {
    await session.close()
  }
}

/**
 * Get order by ID with all items
 */
export async function getOrderById(orderId: string): Promise<OrderWithItems | null> {
  const session = getSession()
  try {
    const result = await session.run(
      `
      MATCH (o:Order {id: $orderId})
      OPTIONAL MATCH (o)-[:HAS_ITEM]->(oi:OrderItem)-[:ITEM_OF_VARIANT]->(v:ProductVariant)-[:VARIANT_OF]->(p:Product)
      WITH o, collect({
        orderItem: oi {.*},
        product: p {.id, .name, .brand, .sku, .images},
        variant: v {.*}
      }) as items
      RETURN o {.*, items: items}
      `,
      { orderId }
    )

    if (result.records.length === 0) return null

    const orderData = result.records[0].get('o')

    // Transform the items to match the expected structure
    const items = orderData.items.map((item: any) => ({
      ...item.orderItem,
      product: item.product,
      variant: item.variant,
    }))

    return {
      ...orderData,
      shippingAddress: JSON.parse(orderData.shippingAddress),
      items,
    }
  } finally {
    await session.close()
  }
}

/**
 * Get all orders for a user
 */
export async function getUserOrders(userId: string): Promise<OrderWithItems[]> {
  const session = getSession()
  try {
    const result = await session.run(
      `
      MATCH (u:User {id: $userId})-[:PLACED_ORDER]->(o:Order)
      OPTIONAL MATCH (o)-[:HAS_ITEM]->(oi:OrderItem)-[:ITEM_OF_VARIANT]->(v:ProductVariant)-[:VARIANT_OF]->(p:Product)
      WITH o, collect({
        orderItem: oi {.*},
        product: p {.id, .name, .brand, .sku, .images},
        variant: v {.*}
      }) as items
      RETURN o {.*, items: items}
      ORDER BY o.createdAt DESC
      `,
      { userId }
    )

    return result.records.map((record) => {
      const orderData = record.get('o')
      const items = orderData.items.map((item: any) => ({
        ...item.orderItem,
        product: item.product,
        variant: item.variant,
      }))

      return {
        ...orderData,
        shippingAddress: JSON.parse(orderData.shippingAddress),
        items,
      }
    })
  } finally {
    await session.close()
  }
}

/**
 * Update order status
 */
export async function updateOrderStatus(
  orderId: string,
  status: OrderStatus
): Promise<Order> {
  const session = getSession()
  try {
    const now = new Date().toISOString()

    const result = await session.run(
      `
      MATCH (o:Order {id: $orderId})
      SET o.status = $status, o.updatedAt = $updatedAt
      RETURN o {.*}
      `,
      { orderId, status, updatedAt: now }
    )

    const order = result.records[0].get('o')

    // Parse shippingAddress back from JSON
    return {
      ...order,
      shippingAddress: JSON.parse(order.shippingAddress),
    }
  } finally {
    await session.close()
  }
}

/**
 * Get order count for a user
 */
export async function getUserOrderCount(userId: string): Promise<number> {
  const session = getSession()
  try {
    const result = await session.run(
      `
      MATCH (u:User {id: $userId})-[:PLACED_ORDER]->(o:Order)
      RETURN count(o) as count
      `,
      { userId }
    )

    const count = result.records[0]?.get('count')
    if (!count) return 0
    return typeof count === 'number' ? count : count.toNumber()
  } finally {
    await session.close()
  }
}

/**
 * Get all orders (for admin)
 */
export async function getAllOrders(): Promise<OrderWithItems[]> {
  const session = getSession()
  try {
    const result = await session.run(
      `
      MATCH (o:Order)
      OPTIONAL MATCH (o)-[:HAS_ITEM]->(oi:OrderItem)-[:ITEM_OF_VARIANT]->(v:ProductVariant)-[:VARIANT_OF]->(p:Product)
      WITH o, collect({
        orderItem: oi {.*},
        product: p {.id, .name, .brand, .sku, .images},
        variant: v {.*}
      }) as items
      RETURN o {.*, items: items}
      ORDER BY o.createdAt DESC
      `
    )

    return result.records.map((record) => {
      const orderData = record.get('o')
      const items = orderData.items.map((item: any) => ({
        ...item.orderItem,
        product: item.product,
        variant: item.variant,
      }))

      return {
        ...orderData,
        shippingAddress: JSON.parse(orderData.shippingAddress),
        items,
      }
    })
  } finally {
    await session.close()
  }
}

/**
 * Update order payment proof
 */
export async function updateOrderPaymentProof(
  orderId: string,
  userId: string,
  paymentProof: string
): Promise<Order> {
  const session = getSession()
  try {
    const now = new Date().toISOString()

    const result = await session.run(
      `
      MATCH (o:Order {id: $orderId, userId: $userId})
      SET o.paymentProof = $paymentProof, o.updatedAt = $updatedAt
      RETURN o {.*}
      `,
      { orderId, userId, paymentProof, updatedAt: now }
    )

    if (result.records.length === 0) {
      throw new Error('Order not found or does not belong to user')
    }

    const order = result.records[0].get('o')

    // Parse shippingAddress back from JSON
    return {
      ...order,
      shippingAddress: JSON.parse(order.shippingAddress),
    }
  } finally {
    await session.close()
  }
}
