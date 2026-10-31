import { getSession } from '../db'
import neo4j from 'neo4j-driver'
import type { ProductWithVariants } from './product.repository'
import type { ProductCategory } from '../types'

/**
 * Get personalized product recommendations for a user
 * Combines browsing history, preferences, and collaborative filtering
 */
export async function getRecommendationsForUser(
  userId: string,
  limit: number = 10
): Promise<ProductWithVariants[]> {
  const session = getSession()
  try {
    const result = await session.run(
      `
      // Get user's browsing history to find preferred brands and categories
      MATCH (v:ProductView {userId: $userId})-[:VIEWED_PRODUCT]->(viewedProduct:Product)
      WITH collect(DISTINCT viewedProduct.brand) as viewedBrands,
           collect(DISTINCT viewedProduct.category) as viewedCategories,
           collect(DISTINCT viewedProduct.id) as viewedProductIds

      // Find products with similar characteristics that user hasn't viewed
      MATCH (p:Product)
      WHERE NOT p.id IN viewedProductIds
        AND (p.brand IN viewedBrands OR p.category IN viewedCategories)

      // Calculate recommendation score
      WITH p,
           CASE WHEN p.brand IN viewedBrands THEN 2 ELSE 0 END as brandScore,
           CASE WHEN p.category IN viewedCategories THEN 1 ELSE 0 END as categoryScore

      // Get variants
      OPTIONAL MATCH (variant:ProductVariant)-[:VARIANT_OF]->(p)
      WITH p, (brandScore + categoryScore) as score, collect(variant {.*}) as variants
      WHERE size(variants) > 0 AND any(v IN variants WHERE v.stockQuantity > 0)

      RETURN p {.*, variants: variants}
      ORDER BY score DESC, p.createdAt DESC
      LIMIT $limit
      `,
      { userId, limit: neo4j.int(limit) }
    )

    return result.records.map((record) => record.get('p'))
  } finally {
    await session.close()
  }
}

/**
 * Get recommendations based on a specific product (similar products)
 */
export async function getSimilarProducts(
  productId: string,
  limit: number = 6
): Promise<ProductWithVariants[]> {
  const session = getSession()
  try {
    const result = await session.run(
      `
      // Get the current product details
      MATCH (current:Product {id: $productId})

      // Find similar products (same category or brand, but not the same product)
      MATCH (p:Product)
      WHERE p.id <> $productId
        AND (p.category = current.category OR p.brand = current.brand)

      // Calculate similarity score
      WITH p, current,
           CASE WHEN p.category = current.category THEN 2 ELSE 0 END as categoryScore,
           CASE WHEN p.brand = current.brand THEN 1 ELSE 0 END as brandScore,
           CASE WHEN p.gender = current.gender THEN 1 ELSE 0 END as genderScore

      // Get variants
      OPTIONAL MATCH (variant:ProductVariant)-[:VARIANT_OF]->(p)
      WITH p, (categoryScore + brandScore + genderScore) as score, collect(variant {.*}) as variants
      WHERE size(variants) > 0 AND any(v IN variants WHERE v.stockQuantity > 0)

      RETURN p {.*, variants: variants}
      ORDER BY score DESC, p.createdAt DESC
      LIMIT $limit
      `,
      { productId, limit: neo4j.int(limit) }
    )

    return result.records.map((record) => record.get('p'))
  } finally {
    await session.close()
  }
}

/**
 * Get trending products based on recent views across all users
 */
export async function getTrendingProducts(limit: number = 10): Promise<ProductWithVariants[]> {
  const session = getSession()
  try {
    // Get views from the last 7 days
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

    const result = await session.run(
      `
      MATCH (v:ProductView)-[:VIEWED_PRODUCT]->(p:Product)
      WHERE datetime(v.viewedAt) > datetime($sevenDaysAgo)

      WITH p, count(v) as viewCount
      OPTIONAL MATCH (variant:ProductVariant)-[:VARIANT_OF]->(p)
      WITH p, viewCount, collect(variant {.*}) as variants
      WHERE size(variants) > 0 AND any(v IN variants WHERE v.stockQuantity > 0)

      RETURN p {.*, variants: variants}
      ORDER BY viewCount DESC, p.createdAt DESC
      LIMIT $limit
      `,
      { sevenDaysAgo: sevenDaysAgo.toISOString(), limit: neo4j.int(limit) }
    )

    return result.records.map((record) => record.get('p'))
  } finally {
    await session.close()
  }
}

/**
 * Get new arrivals (recently added products)
 */
export async function getNewArrivals(limit: number = 10): Promise<ProductWithVariants[]> {
  const session = getSession()
  try {
    const result = await session.run(
      `
      MATCH (p:Product)
      OPTIONAL MATCH (variant:ProductVariant)-[:VARIANT_OF]->(p)
      WITH p, collect(variant {.*}) as variants
      WHERE size(variants) > 0 AND any(v IN variants WHERE v.stockQuantity > 0)

      RETURN p {.*, variants: variants}
      ORDER BY p.createdAt DESC
      LIMIT $limit
      `,
      { limit: neo4j.int(limit) }
    )

    return result.records.map((record) => record.get('p'))
  } finally {
    await session.close()
  }
}

/**
 * Get personalized recommendations based on user preferences
 */
export async function getRecommendationsByPreferences(
  preferredBrands: string[],
  preferredCategories: ProductCategory[],
  preferredColors: string[],
  priceMin?: number,
  priceMax?: number,
  limit: number = 10
): Promise<ProductWithVariants[]> {
  const session = getSession()
  try {
    const params: Record<string, any> = { limit: neo4j.int(limit) }
    const conditions: string[] = []

    if (preferredBrands.length > 0) {
      conditions.push('p.brand IN $brands')
      params.brands = preferredBrands
    }

    if (preferredCategories.length > 0) {
      conditions.push('p.category IN $categories')
      params.categories = preferredCategories
    }

    if (priceMin !== undefined) {
      conditions.push('p.retailPrice >= $priceMin')
      params.priceMin = priceMin
    }

    if (priceMax !== undefined) {
      conditions.push('p.retailPrice <= $priceMax')
      params.priceMax = priceMax
    }

    let whereClause = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : ''

    const result = await session.run(
      `
      MATCH (p:Product)
      ${whereClause}
      OPTIONAL MATCH (variant:ProductVariant)-[:VARIANT_OF]->(p)
      ${preferredColors.length > 0 ? 'WHERE variant.color IN $colors' : ''}
      WITH p, collect(variant {.*}) as variants
      WHERE size(variants) > 0 AND any(v IN variants WHERE v.stockQuantity > 0)

      RETURN p {.*, variants: variants}
      ORDER BY p.createdAt DESC
      LIMIT $limit
      `,
      { ...params, colors: preferredColors }
    )

    return result.records.map((record) => record.get('p'))
  } finally {
    await session.close()
  }
}
