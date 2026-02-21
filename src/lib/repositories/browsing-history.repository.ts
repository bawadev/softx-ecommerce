import { getSession } from '../db'
import neo4j from 'neo4j-driver'
import type { ProductView } from '../types'
import type { ProductWithVariants } from './product.repository'

/**
 * Track a product view
 */
export async function trackProductView(userId: string, productId: string): Promise<void> {
  const session = getSession()
  try {
    const viewId = crypto.randomUUID()
    const now = new Date().toISOString()

    await session.run(
      `
      MATCH (u:User {id: $userId})
      MATCH (p:Product {id: $productId})
      CREATE (v:ProductView {
        id: $viewId,
        userId: $userId,
        productId: $productId,
        viewedAt: $viewedAt
      })
      CREATE (v)-[:VIEWED_BY]->(u)
      CREATE (v)-[:VIEWED_PRODUCT]->(p)
      `,
      { userId, productId, viewId, viewedAt: now }
    )
  } finally {
    await session.close()
  }
}

/**
 * Get user's browsing history
 */
export async function getUserBrowsingHistory(
  userId: string,
  limit: number = 20
): Promise<ProductView[]> {
  const session = getSession()
  try {
    const result = await session.run(
      `
      MATCH (v:ProductView {userId: $userId})
      RETURN v {.*}
      ORDER BY v.viewedAt DESC
      LIMIT $limit
      `,
      { userId, limit: neo4j.int(limit) }
    )

    return result.records.map((record) => record.get('v'))
  } finally {
    await session.close()
  }
}

/**
 * Get recently viewed products with full details
 */
export async function getRecentlyViewedProducts(
  userId: string,
  limit: number = 10
): Promise<ProductWithVariants[]> {
  const session = getSession()
  try {
    const result = await session.run(
      `
      MATCH (v:ProductView {userId: $userId})-[:VIEWED_PRODUCT]->(p:Product)
      WHERE NOT EXISTS {
        MATCH (:User {id: $userId})-[:PLACED_ORDER]->(o:Order)-[:HAS_ITEM]->(:OrderItem)-[:ITEM_OF_VARIANT]->(:ProductVariant)-[:VARIANT_OF]->(p)
        WHERE o.status <> 'CANCELLED'
      }
      AND NOT EXISTS {
        MATCH (:User {id: $userId})-[:HAS_CART_ITEM]->(:CartItem)-[:CART_ITEM_FOR]->(:ProductVariant)-[:VARIANT_OF]->(p)
      }
      WITH p, max(v.viewedAt) as lastViewed
      ORDER BY lastViewed DESC
      LIMIT $limit
      OPTIONAL MATCH (variant:ProductVariant)-[:VARIANT_OF]->(p)
      WITH p, collect(DISTINCT variant {.*}) as variants
      RETURN p {.*, variants: variants}
      `,
      { userId, limit: neo4j.int(limit) }
    )

    return result.records.map((record) => record.get('p'))
  } finally {
    await session.close()
  }
}

/**
 * Get user's preferred brands based on browsing history
 */
export async function getPreferredBrandsFromHistory(userId: string): Promise<string[]> {
  const session = getSession()
  try {
    const result = await session.run(
      `
      MATCH (v:ProductView {userId: $userId})-[:VIEWED_PRODUCT]->(p:Product)
      RETURN p.brand as brand, count(*) as viewCount
      ORDER BY viewCount DESC
      LIMIT 5
      `,
      { userId }
    )

    return result.records.map((record) => record.get('brand'))
  } finally {
    await session.close()
  }
}

/**
 * Get user's preferred categories based on browsing history
 */
export async function getPreferredCategoriesFromHistory(userId: string): Promise<string[]> {
  const session = getSession()
  try {
    const result = await session.run(
      `
      MATCH (v:ProductView {userId: $userId})-[:VIEWED_PRODUCT]->(p:Product)
      RETURN p.category as category, count(*) as viewCount
      ORDER BY viewCount DESC
      LIMIT 3
      `,
      { userId }
    )

    return result.records.map((record) => record.get('category'))
  } finally {
    await session.close()
  }
}

/**
 * Clear old browsing history (keep last 100 views)
 */
export async function cleanupOldBrowsingHistory(userId: string): Promise<void> {
  const session = getSession()
  try {
    await session.run(
      `
      MATCH (v:ProductView {userId: $userId})
      WITH v
      ORDER BY v.viewedAt DESC
      SKIP 100
      DETACH DELETE v
      `,
      { userId }
    )
  } finally {
    await session.close()
  }
}
