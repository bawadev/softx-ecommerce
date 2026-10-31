/**
 * Category Repository - Simplified Single-Parent Hierarchy
 *
 * Hierarchy Structure:
 * - Ladies (L0)
 *   - Clothing (L1)
 *     - Tops (L2)
 *       - Shirts (L3)
 *       - Blouses (L3)
 *     - Bottoms (L2)
 *   - Footwear (L1)
 *
 * - Gents (L0)
 *   - Clothing (L1)
 *     - Tops (L2)
 *       - Shirts (L3) [Same name as Ladies>Clothing>Tops>Shirts but different hierarchy]
 *
 * - Kids (L0)
 *   - Girls (L1)
 *   - Boys (L1)
 */

import { Session } from 'neo4j-driver'
import { v4 as uuidv4 } from 'uuid'
import { convertNeo4jIntegers } from '../neo4j-utils'

export interface Category {
  id: string
  name: string
  slug: string
  hierarchy: string // Top-level hierarchy identifier (dynamic, supports any custom hierarchy)
  parentId: string | null
  level: number
  isActive: boolean
  isFeatured: boolean
  productCount?: number
  createdAt: string
  updatedAt: string
}

export interface CategoryWithChildren extends Category {
  children: CategoryWithChildren[]
}

export interface CategoryTree {
  [hierarchy: string]: CategoryWithChildren[]
}

/**
 * Create a new category
 */
export async function createCategory(
  session: Session,
  name: string,
  hierarchy: string,
  parentId: string | null = null,
  isFeatured: boolean = false
): Promise<Category> {
  const id = uuidv4()
  // Slug is not unique - same names can appear in different hierarchies
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-')
  const now = new Date().toISOString()

  let level = 0

  // If has parent, calculate level
  if (parentId) {
    const parentResult = await session.run(
      `MATCH (parent:Category {id: $parentId})
       RETURN parent.level as level`,
      { parentId }
    )

    if (parentResult.records.length === 0) {
      throw new Error('Parent category not found')
    }

    level = parentResult.records[0].get('level') + 1
  }

  const result = await session.run(
    `CREATE (c:Category {
      id: $id,
      name: $name,
      slug: $slug,
      hierarchy: $hierarchy,
      parentId: $parentId,
      level: $level,
      isActive: true,
      isFeatured: $isFeatured,
      createdAt: $createdAt,
      updatedAt: $updatedAt
    })
    ${parentId ? 'WITH c MATCH (parent:Category {id: $parentId}) CREATE (c)-[:CHILD_OF]->(parent)' : ''}
    RETURN c`,
    { id, name, slug, hierarchy, parentId, level, isFeatured, createdAt: now, updatedAt: now }
  )

  return convertNeo4jIntegers(result.records[0].get('c').properties)
}

/**
 * Get all root categories with descendant product counts
 * Dynamically supports any root hierarchy
 */
export async function getRootCategories(session: Session): Promise<Category[]> {
  const result = await session.run(
    `MATCH (c:Category)
     WHERE c.level = 0
     OPTIONAL MATCH (c)<-[:CHILD_OF*0..]-(descendant:Category)<-[:HAS_CATEGORY]-(p:Product)
     WITH c, count(DISTINCT p) as productCount
     RETURN c {.*, productCount: productCount}
     ORDER BY c.name ASC`
  )

  return result.records.map(record => convertNeo4jIntegers(record.get('c')))
}

/**
 * Get children of a category
 */
export async function getChildCategories(
  session: Session,
  parentId: string
): Promise<Category[]> {
  const result = await session.run(
    `MATCH (c:Category)-[:CHILD_OF]->(parent:Category {id: $parentId})
     OPTIONAL MATCH (p:Product)-[:HAS_CATEGORY]->(c)
     WITH c, count(DISTINCT p) as productCount
     RETURN c {.*, productCount: productCount}
     ORDER BY c.name`,
    { parentId }
  )

  return result.records.map(record => convertNeo4jIntegers(record.get('c')))
}

/**
 * Get child categories with descendant product counts (rolls up from all sub-levels)
 */
export async function getChildCategoriesWithDescendantCounts(
  session: Session,
  parentId: string
): Promise<Category[]> {
  const result = await session.run(
    `MATCH (c:Category)-[:CHILD_OF]->(parent:Category {id: $parentId})
     OPTIONAL MATCH (c)<-[:CHILD_OF*0..]-(descendant:Category)<-[:HAS_CATEGORY]-(p:Product)
     WITH c, count(DISTINCT p) as productCount
     RETURN c {.*, productCount: productCount}
     ORDER BY c.name`,
    { parentId }
  )

  return result.records.map(record => convertNeo4jIntegers(record.get('c')))
}

/**
 * Get category by ID
 */
export async function getCategoryById(
  session: Session,
  id: string
): Promise<Category | null> {
  const result = await session.run(
    `MATCH (c:Category {id: $id})
     OPTIONAL MATCH (p:Product)-[:HAS_CATEGORY]->(c)
     WITH c, count(DISTINCT p) as productCount
     RETURN c {.*, productCount: productCount}`,
    { id }
  )

  if (result.records.length === 0) {
    return null
  }

  return convertNeo4jIntegers(result.records[0].get('c'))
}

/**
 * Get complete category tree for all hierarchies
 */
export async function getCategoryTree(session: Session): Promise<CategoryTree> {
  // Get all categories with product counts including all descendants recursively
  const result = await session.run(
    `MATCH (c:Category)
     OPTIONAL MATCH (c)<-[:CHILD_OF*0..]-(descendant:Category)<-[:HAS_CATEGORY]-(p:Product)
     WITH c, count(DISTINCT p) as productCount
     RETURN c.id as id,
            c.name as name,
            c.slug as slug,
            c.hierarchy as hierarchy,
            c.parentId as parentId,
            c.level as level,
            c.isActive as isActive,
            c.isFeatured as isFeatured,
            c.createdAt as createdAt,
            c.updatedAt as updatedAt,
            productCount
     ORDER BY c.level, c.name`
  )

  const allCategories: Category[] = result.records.map(record => {
    return {
      id: record.get('id'),
      name: record.get('name'),
      slug: record.get('slug'),
      hierarchy: record.get('hierarchy'),
      parentId: record.get('parentId'),
      level: convertNeo4jIntegers(record.get('level')),
      isActive: record.get('isActive'),
      isFeatured: record.get('isFeatured'),
      productCount: convertNeo4jIntegers(record.get('productCount')),
      createdAt: record.get('createdAt')?.toString() || '',
      updatedAt: record.get('updatedAt')?.toString() || '',
    }
  })

  // Build tree structure
  const categoryMap = new Map<string, CategoryWithChildren>()

  // Initialize all categories with empty children array
  allCategories.forEach(cat => {
    categoryMap.set(cat.id, { ...cat, children: [] })
  })

  // Separate by hierarchy (dynamic grouping)
  const hierarchyMap: { [hierarchy: string]: CategoryWithChildren[] } = {}

  // Build parent-child relationships
  allCategories.forEach(cat => {
    const category = categoryMap.get(cat.id)!

    if (cat.parentId) {
      const parent = categoryMap.get(cat.parentId)
      if (parent) {
        parent.children.push(category)
      }
    } else {
      // Root category - group by hierarchy
      if (!hierarchyMap[cat.hierarchy]) {
        hierarchyMap[cat.hierarchy] = []
      }
      hierarchyMap[cat.hierarchy].push(category)
    }
  })

  return hierarchyMap
}

/**
 * Get all categories in a hierarchy
 */
export async function getCategoriesByHierarchy(
  session: Session,
  hierarchy: string
): Promise<Category[]> {
  const result = await session.run(
    `MATCH (c:Category {hierarchy: $hierarchy})
     OPTIONAL MATCH (p:Product)-[:HAS_CATEGORY]->(c)
     WITH c, count(DISTINCT p) as productCount
     RETURN c {.*, productCount: productCount}
     ORDER BY c.level, c.name`,
    { hierarchy }
  )

  return result.records.map(record => convertNeo4jIntegers(record.get('c')))
}

/**
 * Update category name and status
 */
export async function updateCategory(
  session: Session,
  id: string,
  updates: {
    name?: string
    isActive?: boolean
    isFeatured?: boolean
  }
): Promise<Category> {
  const setters: string[] = []
  const params: Record<string, unknown> = { id, updatedAt: new Date().toISOString() }

  if (updates.name !== undefined) {
    setters.push('c.name = $name')
    setters.push('c.slug = $slug')
    params.name = updates.name
    params.slug = updates.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')
  }

  if (updates.isActive !== undefined) {
    setters.push('c.isActive = $isActive')
    params.isActive = updates.isActive
  }

  if (updates.isFeatured !== undefined) {
    setters.push('c.isFeatured = $isFeatured')
    params.isFeatured = updates.isFeatured
  }

  setters.push('c.updatedAt = $updatedAt')

  const result = await session.run(
    `MATCH (c:Category {id: $id})
     SET ${setters.join(', ')}
     RETURN c`,
    params
  )

  if (result.records.length === 0) {
    throw new Error('Category not found')
  }

  return convertNeo4jIntegers(result.records[0].get('c').properties)
}

/**
 * Delete category (only if no children and no products)
 */
export async function deleteCategory(
  session: Session,
  id: string
): Promise<{ success: boolean; message?: string }> {
  // Get category info
  const categoryResult = await session.run(
    `MATCH (c:Category {id: $id})
     RETURN c.name as name`,
    { id }
  )

  if (categoryResult.records.length === 0) {
    return {
      success: false,
      message: 'Category not found'
    }
  }

  const categoryName = categoryResult.records[0].get('name')

  // Check for children
  const childrenResult = await session.run(
    `MATCH (c:Category {id: $id})<-[:CHILD_OF]-(child:Category)
     RETURN count(child) as childCount`,
    { id }
  )

  const childCount = childrenResult.records[0].get('childCount').toNumber()
  if (childCount > 0) {
    return {
      success: false,
      message: `Cannot delete "${categoryName}" because it has ${childCount} child ${childCount === 1 ? 'category' : 'categories'}. Please delete the child categories first.`
    }
  }

  // Check for products
  const productResult = await session.run(
    `MATCH (c:Category {id: $id})<-[:HAS_CATEGORY]-(p:Product)
     RETURN count(p) as productCount`,
    { id }
  )

  const productCount = productResult.records[0].get('productCount').toNumber()
  if (productCount > 0) {
    return {
      success: false,
      message: `Cannot delete "${categoryName}" because it has ${productCount} ${productCount === 1 ? 'product' : 'products'} assigned. Please remove or reassign the products first.`
    }
  }

  // Delete category
  await session.run(
    `MATCH (c:Category {id: $id})
     DETACH DELETE c`,
    { id }
  )

  return { success: true }
}

/**
 * Move category to a new parent
 */
export async function moveCategory(
  session: Session,
  categoryId: string,
  newParentId: string | null
): Promise<Category> {
  // Validate new parent exists
  if (newParentId) {
    const parentExists = await session.run(
      `MATCH (p:Category {id: $newParentId})
       RETURN p`,
      { newParentId }
    )

    if (parentExists.records.length === 0) {
      throw new Error('New parent category not found')
    }

    // Prevent moving to a descendant
    const isDescendant = await session.run(
      `MATCH (c:Category {id: $categoryId})
       MATCH (newParent:Category {id: $newParentId})
       OPTIONAL MATCH path = (newParent)-[:CHILD_OF*1..]->(c)
       RETURN path IS NOT NULL as isDescendant`,
      { categoryId, newParentId }
    )

    if (isDescendant.records[0].get('isDescendant')) {
      throw new Error('Cannot move category to its own descendant')
    }
  }

  // Get new level
  let newLevel = 0
  if (newParentId) {
    const parentResult = await session.run(
      `MATCH (p:Category {id: $newParentId})
       RETURN p.level as level`,
      { newParentId }
    )
    newLevel = parentResult.records[0].get('level') + 1
  }

  // Update category and relationships
  await session.run(
    `MATCH (c:Category {id: $categoryId})
     OPTIONAL MATCH (c)-[r:CHILD_OF]->()
     DELETE r
     SET c.parentId = $newParentId, c.level = $newLevel, c.updatedAt = $updatedAt
     ${newParentId ? 'WITH c MATCH (parent:Category {id: $newParentId}) CREATE (c)-[:CHILD_OF]->(parent)' : ''}`,
    { categoryId, newParentId, newLevel, updatedAt: new Date().toISOString() }
  )

  // Recursively update descendant levels
  await recalculateDescendantLevels(session, categoryId)

  // Return updated category
  const result = await session.run(
    `MATCH (c:Category {id: $categoryId})
     RETURN c`,
    { categoryId }
  )

  return convertNeo4jIntegers(result.records[0].get('c').properties)
}

/**
 * Recursively recalculate levels for all descendants
 */
async function recalculateDescendantLevels(
  session: Session,
  parentId: string
): Promise<void> {
  const result = await session.run(
    `MATCH (parent:Category {id: $parentId})
     MATCH (child:Category)-[:CHILD_OF]->(parent)
     SET child.level = parent.level + 1, child.updatedAt = $updatedAt
     RETURN child.id as childId`,
    { parentId, updatedAt: new Date().toISOString() }
  )

  // Recursively update each child's descendants
  for (const record of result.records) {
    const childId = record.get('childId')
    await recalculateDescendantLevels(session, childId)
  }
}

/**
 * Validate if a category is a leaf (has no children)
 * Products should only be assigned to leaf categories
 */
export async function validateLeafCategoryForProduct(
  session: Session,
  categoryId: string
): Promise<{ valid: boolean; error?: string; categoryName?: string }> {
  const result = await session.run(
    `MATCH (c:Category {id: $categoryId})
     OPTIONAL MATCH (c)<-[:CHILD_OF]-(child:Category)
     WITH c, count(child) as childCount
     RETURN c.name as name, childCount`,
    { categoryId }
  )

  if (result.records.length === 0) {
    return { valid: false, error: `Category with ID ${categoryId} not found` }
  }

  const record = result.records[0]
  const categoryName = record.get('name')
  const childCount = convertNeo4jIntegers(record.get('childCount'))

  if (childCount > 0) {
    return {
      valid: false,
      error: `Cannot assign products to parent category "${categoryName}". This category has ${childCount} child ${childCount === 1 ? 'category' : 'categories'}. Please assign to a leaf category (one without children).`,
      categoryName
    }
  }

  return { valid: true, categoryName }
}

/**
 * Assign products to categories
 * IMPORTANT: Only leaf categories (those without children) can have products assigned
 */
export async function assignProductToCategories(
  session: Session,
  productId: string,
  categoryIds: string[]
): Promise<void> {
  // Validate all categories are leaf categories
  for (const categoryId of categoryIds) {
    const validation = await validateLeafCategoryForProduct(session, categoryId)
    if (!validation.valid) {
      throw new Error(validation.error!)
    }
  }

  // Remove existing category relationships
  await session.run(
    `MATCH (p:Product {id: $productId})-[r:HAS_CATEGORY]->()
     DELETE r`,
    { productId }
  )

  // Create new relationships
  if (categoryIds.length > 0) {
    await session.run(
      `MATCH (p:Product {id: $productId})
       UNWIND $categoryIds as categoryId
       MATCH (c:Category {id: categoryId})
       CREATE (p)-[:HAS_CATEGORY]->(c)`,
      { productId, categoryIds }
    )
  }
}

/**
 * Get categories for a product
 */
export async function getCategoriesForProduct(
  session: Session,
  productId: string
): Promise<string[]> {
  const result = await session.run(
    `MATCH (p:Product {id: $productId})-[:HAS_CATEGORY]->(c:Category)
     RETURN c.id as categoryId`,
    { productId }
  )

  return result.records.map((record) => record.get('categoryId'))
}

/**
 * Get products by categories (includes descendants)
 */
export async function getProductsByCategories(
  session: Session,
  categoryIds: string[],
  includeDescendants: boolean = true
): Promise<string[]> {
  const query = includeDescendants
    ? `UNWIND $categoryIds as categoryId
       MATCH (c:Category {id: categoryId})
       OPTIONAL MATCH (descendant:Category)-[:CHILD_OF*0..]->(c)
       WITH collect(DISTINCT descendant.id) + collect(DISTINCT c.id) as allCategoryIds
       UNWIND allCategoryIds as catId
       MATCH (p:Product)-[:HAS_CATEGORY]->(cat:Category {id: catId})
       RETURN DISTINCT p.id as productId`
    : `UNWIND $categoryIds as categoryId
       MATCH (p:Product)-[:HAS_CATEGORY]->(c:Category {id: categoryId})
       RETURN DISTINCT p.id as productId`

  const result = await session.run(query, { categoryIds })
  return result.records.map(record => record.get('productId'))
}

/**
 * Get featured categories (for homepage) with descendant product counts
 */
export async function getFeaturedCategories(session: Session): Promise<Category[]> {
  const result = await session.run(
    `MATCH (c:Category {isFeatured: true, isActive: true})
     OPTIONAL MATCH (c)<-[:CHILD_OF*0..]-(descendant:Category)<-[:HAS_CATEGORY]-(p:Product)
     WITH c, count(DISTINCT p) as productCount
     RETURN c {.*, productCount: productCount}
     ORDER BY c.level, c.name`
  )

  return result.records.map(record => convertNeo4jIntegers(record.get('c')))
}

/**
 * Get category path (breadcrumb)
 */
export async function getCategoryPath(
  session: Session,
  categoryId: string
): Promise<Category[]> {
  const result = await session.run(
    `MATCH path = (c:Category {id: $categoryId})-[:CHILD_OF*0..]->(ancestor:Category)
     WHERE ancestor.parentId IS NULL
     WITH nodes(path) as pathNodes
     UNWIND pathNodes as node
     RETURN node {.*}
     ORDER BY node.level`,
    { categoryId }
  )

  return result.records.map(record => record.get('node'))
}

/**
 * Find duplicate category names across hierarchies
 */
export async function findDuplicateNames(session: Session): Promise<{
  name: string
  categories: Category[]
}[]> {
  const result = await session.run(
    `MATCH (c:Category)
     WITH c.name as name, collect(c {.*}) as categories
     WHERE size(categories) > 1
     RETURN name, categories
     ORDER BY name`
  )

  return result.records.map(record => ({
    name: record.get('name'),
    categories: record.get('categories')
  }))
}

/**
 * Get all leaf categories (categories without children)
 * These are the only categories that can have products assigned
 */
export async function getLeafCategories(session: Session): Promise<Category[]> {
  const result = await session.run(
    `MATCH (c:Category)
     WHERE NOT EXISTS {
       MATCH (c)<-[:CHILD_OF]-(child:Category)
     }
     OPTIONAL MATCH (p:Product)-[:HAS_CATEGORY]->(c)
     WITH c, count(DISTINCT p) as productCount
     RETURN c {.*, productCount: productCount}
     ORDER BY c.hierarchy, c.level, c.name`
  )

  return result.records.map(record => convertNeo4jIntegers(record.get('c')))
}

/**
 * Get leaf categories by hierarchy
 */
export async function getLeafCategoriesByHierarchy(
  session: Session,
  hierarchy: string
): Promise<Category[]> {
  const result = await session.run(
    `MATCH (c:Category {hierarchy: $hierarchy})
     WHERE NOT EXISTS {
       MATCH (c)<-[:CHILD_OF]-(child:Category)
     }
     OPTIONAL MATCH (p:Product)-[:HAS_CATEGORY]->(c)
     WITH c, count(DISTINCT p) as productCount
     RETURN c {.*, productCount: productCount}
     ORDER BY c.level, c.name`,
    { hierarchy }
  )

  return result.records.map(record => convertNeo4jIntegers(record.get('c')))
}

/**
 * Get category statistics
 */
export async function getCategoryStatistics(session: Session): Promise<{
  totalCategories: number
  categoriesByHierarchy: { ladies: number; gents: number; kids: number }
  categoriesByLevel: { [level: number]: number }
  featuredCount: number
  categoriesWithProducts: number
}> {
  const result = await session.run(
    `MATCH (c:Category)
     OPTIONAL MATCH (c)<-[:HAS_CATEGORY]-(p:Product)
     WITH c, count(DISTINCT p) > 0 as hasProducts
     RETURN
       count(c) as total,
       sum(CASE WHEN c.hierarchy = 'ladies' THEN 1 ELSE 0 END) as ladies,
       sum(CASE WHEN c.hierarchy = 'gents' THEN 1 ELSE 0 END) as gents,
       sum(CASE WHEN c.hierarchy = 'kids' THEN 1 ELSE 0 END) as kids,
       sum(CASE WHEN c.isFeatured THEN 1 ELSE 0 END) as featured,
       sum(CASE WHEN hasProducts THEN 1 ELSE 0 END) as withProducts,
       collect({level: c.level, count: 1}) as levelData`
  )

  const record = result.records[0]

  // Process level counts
  const levelData = record.get('levelData')
  const categoriesByLevel: { [level: number]: number } = {}
  levelData.forEach((item: any) => {
    categoriesByLevel[item.level] = (categoriesByLevel[item.level] || 0) + 1
  })

  return {
    totalCategories: record.get('total').toNumber(),
    categoriesByHierarchy: {
      ladies: record.get('ladies').toNumber(),
      gents: record.get('gents').toNumber(),
      kids: record.get('kids').toNumber()
    },
    categoriesByLevel,
    featuredCount: record.get('featured').toNumber(),
    categoriesWithProducts: record.get('withProducts').toNumber()
  }
}
