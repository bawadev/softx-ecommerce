import { Session } from 'neo4j-driver'
import neo4j from 'neo4j-driver'
import { PromotionalCategory, PromotionalCategoryItem } from '@/lib/types'
import { ProductWithVariants } from './product.repository'

/**
 * Helper function to safely convert Neo4j integers to JavaScript numbers
 */
function toNumber(value: any): number {
  if (value && typeof value.toNumber === 'function') {
    return value.toNumber()
  }
  return Number(value)
}

/**
 * Create a new promotional category
 */
export async function createPromotionalCategory(
  session: Session,
  data: {
    name: string
    slug: string
    description?: string
    displayOrder: number
    isActive?: boolean
    startDate?: string
    endDate?: string
  }
): Promise<PromotionalCategory> {
  const result = await session.run(
    `
    CREATE (c:PromotionalCategory {
      id: randomUUID(),
      name: $name,
      slug: $slug,
      description: $description,
      displayOrder: $displayOrder,
      isActive: $isActive,
      startDate: $startDate,
      endDate: $endDate,
      createdAt: $now,
      updatedAt: $now
    })
    RETURN c
    `,
    {
      name: data.name,
      slug: data.slug,
      description: data.description || null,
      displayOrder: data.displayOrder,
      isActive: data.isActive ?? true,
      startDate: data.startDate || null,
      endDate: data.endDate || null,
      now: new Date().toISOString(),
    }
  )

  const record = result.records[0]
  const category = record.get('c').properties

  return {
    id: category.id,
    name: category.name,
    slug: category.slug,
    description: category.description,
    displayOrder: toNumber(category.displayOrder),
    isActive: category.isActive,
    startDate: category.startDate,
    endDate: category.endDate,
    createdAt: category.createdAt.toString(),
    updatedAt: category.updatedAt.toString(),
  }
}

/**
 * Get all promotional categories
 */
export async function getAllPromotionalCategories(
  session: Session,
  activeOnly = false
): Promise<PromotionalCategory[]> {
  const query = activeOnly
    ? `
    MATCH (c:PromotionalCategory)
    WHERE c.isActive = true
    RETURN c
    ORDER BY c.displayOrder ASC
    `
    : `
    MATCH (c:PromotionalCategory)
    RETURN c
    ORDER BY c.displayOrder ASC
    `

  const result = await session.run(query)

  return result.records.map((record) => {
    const category = record.get('c').properties
    return {
      id: category.id,
      name: category.name,
      slug: category.slug,
      description: category.description,
      displayOrder: toNumber(category.displayOrder),
      isActive: category.isActive,
      startDate: category.startDate,
      endDate: category.endDate,
      createdAt: category.createdAt.toString(),
      updatedAt: category.updatedAt.toString(),
    }
  })
}

/**
 * Get promotional category by ID
 */
export async function getPromotionalCategoryById(
  session: Session,
  categoryId: string
): Promise<PromotionalCategory | null> {
  const result = await session.run(
    `
    MATCH (c:PromotionalCategory {id: $categoryId})
    RETURN c
    `,
    { categoryId }
  )

  if (result.records.length === 0) return null

  const category = result.records[0].get('c').properties
  return {
    id: category.id,
    name: category.name,
    slug: category.slug,
    description: category.description,
    displayOrder: toNumber(category.displayOrder),
    isActive: category.isActive,
    startDate: category.startDate,
    endDate: category.endDate,
    createdAt: category.createdAt.toString(),
    updatedAt: category.updatedAt.toString(),
  }
}

/**
 * Get promotional category by slug
 */
export async function getPromotionalCategoryBySlug(
  session: Session,
  slug: string
): Promise<PromotionalCategory | null> {
  const result = await session.run(
    `
    MATCH (c:PromotionalCategory {slug: $slug})
    RETURN c
    `,
    { slug }
  )

  if (result.records.length === 0) return null

  const category = result.records[0].get('c').properties
  return {
    id: category.id,
    name: category.name,
    slug: category.slug,
    description: category.description,
    displayOrder: toNumber(category.displayOrder),
    isActive: category.isActive,
    startDate: category.startDate,
    endDate: category.endDate,
    createdAt: category.createdAt.toString(),
    updatedAt: category.updatedAt.toString(),
  }
}

/**
 * Update promotional category
 */
export async function updatePromotionalCategory(
  session: Session,
  categoryId: string,
  data: Partial<{
    name: string
    slug: string
    description: string
    displayOrder: number
    isActive: boolean
    startDate: string
    endDate: string
  }>
): Promise<PromotionalCategory | null> {
  const updates: string[] = []
  const params: Record<string, any> = { categoryId }

  if (data.name !== undefined) {
    updates.push('c.name = $name')
    params.name = data.name
  }
  if (data.slug !== undefined) {
    updates.push('c.slug = $slug')
    params.slug = data.slug
  }
  if (data.description !== undefined) {
    updates.push('c.description = $description')
    params.description = data.description
  }
  if (data.displayOrder !== undefined) {
    updates.push('c.displayOrder = $displayOrder')
    params.displayOrder = data.displayOrder
  }
  if (data.isActive !== undefined) {
    updates.push('c.isActive = $isActive')
    params.isActive = data.isActive
  }
  if (data.startDate !== undefined) {
    updates.push('c.startDate = $startDate')
    params.startDate = data.startDate
  }
  if (data.endDate !== undefined) {
    updates.push('c.endDate = $endDate')
    params.endDate = data.endDate
  }

  if (updates.length === 0) return null

  updates.push('c.updatedAt = $updatedAt')
  params.updatedAt = new Date().toISOString()

  const result = await session.run(
    `
    MATCH (c:PromotionalCategory {id: $categoryId})
    SET ${updates.join(', ')}
    RETURN c
    `,
    params
  )

  if (result.records.length === 0) return null

  const category = result.records[0].get('c').properties
  return {
    id: category.id,
    name: category.name,
    slug: category.slug,
    description: category.description,
    displayOrder: toNumber(category.displayOrder),
    isActive: category.isActive,
    startDate: category.startDate,
    endDate: category.endDate,
    createdAt: category.createdAt.toString(),
    updatedAt: category.updatedAt.toString(),
  }
}

/**
 * Delete promotional category
 */
export async function deletePromotionalCategory(
  session: Session,
  categoryId: string
): Promise<boolean> {
  const result = await session.run(
    `
    MATCH (c:PromotionalCategory {id: $categoryId})
    OPTIONAL MATCH (c)-[r:HAS_ITEM]->()
    DELETE r, c
    RETURN count(c) as deleted
    `,
    { categoryId }
  )

  return result.records[0].get('deleted') > 0
}

/**
 * Add product to promotional category with quantity
 */
export async function addProductToCategory(
  session: Session,
  categoryId: string,
  productId: string,
  allocatedQuantity: number
): Promise<PromotionalCategoryItem> {
  const result = await session.run(
    `
    MATCH (c:PromotionalCategory {id: $categoryId})
    MATCH (p:Product {id: $productId})
    MERGE (c)-[r:HAS_ITEM]->(p)
    ON CREATE SET
      r.id = randomUUID(),
      r.allocatedQuantity = $allocatedQuantity,
      r.soldQuantity = 0,
      r.isActive = true,
      r.addedAt = $now
    ON MATCH SET
      r.allocatedQuantity = $allocatedQuantity
    RETURN r
    `,
    { categoryId, productId, allocatedQuantity, now: new Date().toISOString() }
  )

  const item = result.records[0].get('r').properties

  return {
    id: item.id,
    categoryId,
    productId,
    allocatedQuantity: toNumber(item.allocatedQuantity),
    soldQuantity: toNumber(item.soldQuantity),
    isActive: item.isActive ?? true,
    addedAt: item.addedAt.toString(),
  }
}

/**
 * Remove product from promotional category
 */
export async function removeProductFromCategory(
  session: Session,
  categoryId: string,
  productId: string
): Promise<boolean> {
  const result = await session.run(
    `
    MATCH (c:PromotionalCategory {id: $categoryId})-[r:HAS_ITEM]->(p:Product {id: $productId})
    DELETE r
    RETURN count(r) as deleted
    `,
    { categoryId, productId }
  )

  return result.records[0].get('deleted') > 0
}

/**
 * Update allocated quantity for a product in a category
 */
export async function updateCategoryItemQuantity(
  session: Session,
  categoryId: string,
  productId: string,
  allocatedQuantity: number
): Promise<PromotionalCategoryItem | null> {
  const result = await session.run(
    `
    MATCH (c:PromotionalCategory {id: $categoryId})-[r:HAS_ITEM]->(p:Product {id: $productId})
    SET r.allocatedQuantity = $allocatedQuantity
    RETURN r
    `,
    { categoryId, productId, allocatedQuantity }
  )

  if (result.records.length === 0) return null

  const item = result.records[0].get('r').properties

  return {
    id: item.id,
    categoryId,
    productId,
    allocatedQuantity: toNumber(item.allocatedQuantity),
    soldQuantity: toNumber(item.soldQuantity),
    isActive: item.isActive ?? true,
    addedAt: item.addedAt.toString(),
  }
}

/**
 * Get all products in a promotional category
 */
export async function getProductsByCategory(
  session: Session,
  categoryId: string,
  limit = 20
): Promise<ProductWithVariants[]> {
  const result = await session.run(
    `
    MATCH (c:PromotionalCategory {id: $categoryId})-[r:HAS_ITEM]->(p:Product)
    WHERE r.allocatedQuantity > r.soldQuantity AND COALESCE(r.isActive, true) = true
    OPTIONAL MATCH (p)<-[:VARIANT_OF]-(v:ProductVariant)
    WITH p, r, collect({
      id: v.id,
      productId: v.productId,
      size: v.size,
      color: v.color,
      stockQuantity: v.stockQuantity,
      images: v.images
    }) as variants
    RETURN p, variants, r
    ORDER BY r.addedAt DESC
    LIMIT $limit
    `,
    { categoryId, limit: neo4j.int(limit) }
  )

  return result.records.map((record) => {
    const product = record.get('p').properties
    const variants = record.get('variants')

    return {
      id: product.id,
      name: product.name,
      description: product.description,
      brand: product.brand,
      category: product.category,
      gender: product.gender,
      stockPrice: product.stockPrice,
      retailPrice: product.retailPrice,
      sku: product.sku,
      images: product.images || [],
      createdAt: product.createdAt.toString(),
      updatedAt: product.updatedAt.toString(),
      variants: variants.filter((v: any) => v.id !== null),
    }
  })
}

/**
 * Get category items with product details for admin management
 */
export async function getCategoryItemsWithDetails(
  session: Session,
  categoryId: string
): Promise<
  Array<{
    product: ProductWithVariants
    allocatedQuantity: number
    soldQuantity: number
    remainingQuantity: number
    isActive: boolean
  }>
> {
  const result = await session.run(
    `
    MATCH (c:PromotionalCategory {id: $categoryId})-[r:HAS_ITEM]->(p:Product)
    OPTIONAL MATCH (p)<-[:VARIANT_OF]-(v:ProductVariant)
    WITH p, r, collect({
      id: v.id,
      productId: v.productId,
      size: v.size,
      color: v.color,
      stockQuantity: v.stockQuantity,
      images: v.images
    }) as variants
    RETURN p, variants, r
    ORDER BY r.addedAt DESC
    `,
    { categoryId }
  )

  return result.records.map((record) => {
    const product = record.get('p').properties
    const variants = record.get('variants')
    const item = record.get('r').properties

    const allocatedQuantity = toNumber(item.allocatedQuantity)
    const soldQuantity = toNumber(item.soldQuantity)
    return {
      product: {
        id: product.id,
        name: product.name,
        description: product.description,
        brand: product.brand,
        category: product.category,
        gender: product.gender,
        stockPrice: product.stockPrice,
        retailPrice: product.retailPrice,
        sku: product.sku,
        images: product.images || [],
        createdAt: product.createdAt.toString(),
        updatedAt: product.updatedAt.toString(),
        variants: variants.filter((v: any) => v.id !== null),
      },
      allocatedQuantity,
      soldQuantity,
      remainingQuantity: allocatedQuantity - soldQuantity,
      isActive: item.isActive ?? true,
    }
  })
}

/**
 * Toggle product visibility in a promotional category
 */
export async function toggleProductInCategory(
  session: Session,
  categoryId: string,
  productId: string,
  isActive: boolean
): Promise<boolean> {
  const result = await session.run(
    `
    MATCH (c:PromotionalCategory {id: $categoryId})-[r:HAS_ITEM]->(p:Product {id: $productId})
    SET r.isActive = $isActive
    RETURN count(r) as updated
    `,
    { categoryId, productId, isActive }
  )

  return result.records[0].get('updated') > 0
}

/**
 * Get all promotional categories a product belongs to
 */
export async function getProductCategories(
  session: Session,
  productId: string
): Promise<
  Array<{
    category: PromotionalCategory
    allocatedQuantity: number
    soldQuantity: number
    remainingQuantity: number
  }>
> {
  const result = await session.run(
    `
    MATCH (c:PromotionalCategory)-[r:HAS_ITEM]->(p:Product {id: $productId})
    RETURN c, r
    ORDER BY c.displayOrder ASC
    `,
    { productId }
  )

  return result.records.map((record) => {
    const category = record.get('c').properties
    const item = record.get('r').properties

    const allocatedQuantity = toNumber(item.allocatedQuantity)
    const soldQuantity = toNumber(item.soldQuantity)
    return {
      category: {
        id: category.id,
        name: category.name,
        slug: category.slug,
        description: category.description,
        displayOrder: toNumber(category.displayOrder),
        isActive: category.isActive,
        startDate: category.startDate,
        endDate: category.endDate,
        createdAt: category.createdAt.toString(),
        updatedAt: category.updatedAt.toString(),
      },
      allocatedQuantity,
      soldQuantity,
      remainingQuantity: allocatedQuantity - soldQuantity,
      isActive: item.isActive ?? true,
    }
  })
}

/**
 * Move quantity from one category to another
 */
export async function moveQuantityBetweenCategories(
  session: Session,
  productId: string,
  fromCategoryId: string,
  toCategoryId: string,
  quantity: number
): Promise<boolean> {
  const result = await session.run(
    `
    MATCH (from:PromotionalCategory {id: $fromCategoryId})-[rFrom:HAS_ITEM]->(p:Product {id: $productId})
    MATCH (to:PromotionalCategory {id: $toCategoryId})
    WHERE rFrom.allocatedQuantity - rFrom.soldQuantity >= $quantity
    SET rFrom.allocatedQuantity = rFrom.allocatedQuantity - $quantity
    MERGE (to)-[rTo:HAS_ITEM]->(p)
    ON CREATE SET
      rTo.id = randomUUID(),
      rTo.allocatedQuantity = $quantity,
      rTo.soldQuantity = 0,
      rTo.isActive = true,
      rTo.addedAt = datetime().epochMillis
    ON MATCH SET
      rTo.allocatedQuantity = rTo.allocatedQuantity + $quantity
    RETURN count(rFrom) as moved
    `,
    { productId, fromCategoryId, toCategoryId, quantity, now: new Date().toISOString() }
  )

  return result.records[0].get('moved') > 0
}
