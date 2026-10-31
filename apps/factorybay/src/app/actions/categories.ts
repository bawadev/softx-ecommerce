'use server'

import { getSession } from '@/lib/db'
import { isAdmin } from '@/lib/auth'
import { convertNeo4jIntegers } from '@/lib/neo4j-utils'
import * as categoryRepo from '@/lib/repositories/category.repository'

/**
 * Get all root categories (Ladies, Gents, Kids)
 */
export async function getRootCategoriesAction() {
  const session = getSession()
  try {
    const categories = await categoryRepo.getRootCategories(session)
    return { success: true, data: categories }
  } catch (error: unknown) {
    console.error('Error fetching root categories:', error)
    return { success: false, message: error instanceof Error ? error.message : 'Failed to fetch root categories' }
  } finally {
    await session.close()
  }
}

/**
 * Get complete category tree
 */
export async function getCategoryTreeAction() {
  const session = getSession()
  try {
    const tree = await categoryRepo.getCategoryTree(session)
    // Convert Neo4j Integers to plain numbers for Client Components
    const sanitizedTree = convertNeo4jIntegers(tree)
    return { success: true, data: sanitizedTree }
  } catch (error: unknown) {
    console.error('Error fetching category tree:', error)
    return { success: false, message: error instanceof Error ? error.message : 'Failed to fetch category tree' }
  } finally {
    await session.close()
  }
}

/**
 * Get categories by hierarchy
 */
export async function getCategoriesByHierarchyAction(
  hierarchy: string
) {
  const session = getSession()
  try {
    const categories = await categoryRepo.getCategoriesByHierarchy(session, hierarchy)
    return { success: true, data: categories }
  } catch (error: unknown) {
    console.error('Error fetching categories by hierarchy:', error)
    return { success: false, message: error instanceof Error ? error.message : 'Failed to fetch categories' }
  } finally {
    await session.close()
  }
}

/**
 * Get category by ID
 */
export async function getCategoryByIdAction(id: string) {
  const session = getSession()
  try {
    const category = await categoryRepo.getCategoryById(session, id)
    if (!category) {
      return { success: false, message: 'Category not found' }
    }
    return { success: true, data: category }
  } catch (error: unknown) {
    console.error('Error fetching category:', error)
    return { success: false, message: error instanceof Error ? error.message : 'Failed to fetch category' }
  } finally {
    await session.close()
  }
}

/**
 * Get child categories
 */
export async function getChildCategoriesAction(parentId: string) {
  const session = getSession()
  try {
    const categories = await categoryRepo.getChildCategories(session, parentId)
    return { success: true, data: categories }
  } catch (error: unknown) {
    console.error('Error fetching child categories:', error)
    return { success: false, message: error instanceof Error ? error.message : 'Failed to fetch child categories' }
  } finally {
    await session.close()
  }
}

/**
 * Get child categories with descendant product counts (rolls up from all sub-levels)
 */
export async function getChildCategoriesWithDescendantCountsAction(parentId: string) {
  const session = getSession()
  try {
    const categories = await categoryRepo.getChildCategoriesWithDescendantCounts(session, parentId)
    // Convert Neo4j Integers to plain numbers for Client Components
    const sanitizedCategories = convertNeo4jIntegers(categories)
    return { success: true, data: sanitizedCategories }
  } catch (error: unknown) {
    console.error('Error fetching child categories with descendant counts:', error)
    return { success: false, message: error instanceof Error ? error.message : 'Failed to fetch child categories' }
  } finally {
    await session.close()
  }
}

/**
 * Get featured categories
 */
export async function getFeaturedCategoriesAction() {
  const session = getSession()
  try {
    const categories = await categoryRepo.getFeaturedCategories(session)
    return { success: true, data: categories }
  } catch (error: unknown) {
    console.error('Error fetching featured categories:', error)
    return { success: false, message: error instanceof Error ? error.message : 'Failed to fetch featured categories' }
  } finally {
    await session.close()
  }
}

/**
 * Get category path (breadcrumb)
 */
export async function getCategoryPathAction(categoryId: string) {
  const session = getSession()
  try {
    const path = await categoryRepo.getCategoryPath(session, categoryId)
    return { success: true, data: path }
  } catch (error: unknown) {
    console.error('Error fetching category path:', error)
    return { success: false, message: error instanceof Error ? error.message : 'Failed to fetch category path' }
  } finally {
    await session.close()
  }
}

/**
 * Create a new category (Admin only)
 */
export async function createCategoryAction(
  name: string,
  hierarchy: string,
  parentId: string | null = null,
  isFeatured: boolean = false
) {
  if (!(await isAdmin())) {
    return { success: false, message: 'Unauthorized' }
}

  const session = getSession()
  try {
    const category = await categoryRepo.createCategory(
      session,
      name,
      hierarchy,
      parentId,
      isFeatured
    )
    return { success: true, data: category }
  } catch (error: unknown) {
    console.error('Error creating category:', error)
    return { success: false, message: error instanceof Error ? error.message : 'Operation failed' }
  } finally {
    await session.close()
  }
}

/**
 * Update category (Admin only)
 */
export async function updateCategoryAction(
  id: string,
  updates: {
    name?: string
    isActive?: boolean
    isFeatured?: boolean
  }
) {
  if (!(await isAdmin())) {
    return { success: false, message: 'Unauthorized' }
}

  const session = getSession()
  try {
    const category = await categoryRepo.updateCategory(session, id, updates)
    return { success: true, data: category }
  } catch (error: unknown) {
    console.error('Error updating category:', error)
    return { success: false, message: error instanceof Error ? error.message : 'Operation failed' }
  } finally {
    await session.close()
  }
}

/**
 * Delete category (Admin only)
 */
export async function deleteCategoryAction(id: string) {
  if (!(await isAdmin())) {
    return { success: false, message: 'Unauthorized' }
}

  const session = getSession()
  try {
    const result = await categoryRepo.deleteCategory(session, id)
    // Map 'message' to 'error' for consistency with other actions
    if (!result.success && result.message) {
      return { success: false, message: result.message }
    }
    return { success: result.success }
  } catch (error: unknown) {
    console.error('Error deleting category:', error)
    return { success: false, message: error instanceof Error ? error.message : 'Operation failed' }
  } finally {
    await session.close()
  }
}

/**
 * Move category to new parent (Admin only)
 */
export async function moveCategoryAction(
  categoryId: string,
  newParentId: string | null
) {
  if (!(await isAdmin())) {
    return { success: false, message: 'Unauthorized' }
}

  const session = getSession()
  try {
    const category = await categoryRepo.moveCategory(session, categoryId, newParentId)
    return { success: true, data: category }
  } catch (error: unknown) {
    console.error('Error moving category:', error)
    return { success: false, message: error instanceof Error ? error.message : 'Operation failed' }
  } finally {
    await session.close()
  }
}

/**
 * Get products by categories
 */
export async function getProductsByCategoriesAction(
  categoryIds: string[],
  includeDescendants: boolean = true
) {
  const session = getSession()
  try {
    const productIds = await categoryRepo.getProductsByCategories(
      session,
      categoryIds,
      includeDescendants
    )
    return { success: true, data: productIds }
  } catch (error: unknown) {
    console.error('Error fetching products by categories:', error)
    return { success: false, message: error instanceof Error ? error.message : 'Operation failed' }
  } finally {
    await session.close()
  }
}

/**
 * Get full product objects by categories
 */
export async function getFullProductsByCategoriesAction(categoryIds: string[]) {
  const session = getSession()
  try {
    const result = await session.run(
      `UNWIND $categoryIds as categoryId
       MATCH (c:Category {id: categoryId})
       OPTIONAL MATCH (descendant:Category)-[:CHILD_OF*0..]->(c)
       WITH collect(DISTINCT descendant.id) + collect(DISTINCT c.id) as allCategoryIds
       UNWIND allCategoryIds as catId
       MATCH (p:Product)-[:HAS_CATEGORY]->(cat:Category {id: catId})
       WITH DISTINCT p
       OPTIONAL MATCH (v:ProductVariant)-[:VARIANT_OF]->(p)
       WITH p, collect(v {.*}) as variants
       RETURN p {.*, variants: variants}
       ORDER BY p.createdAt DESC
       LIMIT 50`,
      { categoryIds }
    )

    const products = result.records.map(record => convertNeo4jIntegers(record.get('p')))
    return { success: true, data: products }
  } catch (error: unknown) {
    console.error('Error fetching full products by categories:', error)
    return { success: false, message: error instanceof Error ? error.message : 'Operation failed' }
  } finally {
    await session.close()
  }
}

/**
 * Find duplicate category names
 */
export async function findDuplicateNamesAction() {
  if (!(await isAdmin())) {
    return { success: false, message: 'Unauthorized' }
}

  const session = getSession()
  try {
    const duplicates = await categoryRepo.findDuplicateNames(session)
    return { success: true, data: duplicates }
  } catch (error: unknown) {
    console.error('Error finding duplicate names:', error)
    return { success: false, message: error instanceof Error ? error.message : 'Operation failed' }
  } finally {
    await session.close()
  }
}

/**
 * Get category statistics
 */
export async function getCategoryStatisticsAction() {
  if (!(await isAdmin())) {
    return { success: false, message: 'Unauthorized' }
}

  const session = getSession()
  try {
    const stats = await categoryRepo.getCategoryStatistics(session)
    return { success: true, data: stats }
  } catch (error: unknown) {
    console.error('Error fetching category statistics:', error)
    return { success: false, message: error instanceof Error ? error.message : 'Operation failed' }
  } finally {
    await session.close()
  }
}

/**
 * Get leaf categories (categories without children - can have products)
 */
export async function getLeafCategoriesAction() {
  const session = getSession()
  try {
    const categories = await categoryRepo.getLeafCategories(session)
    return { success: true, data: categories }
  } catch (error: unknown) {
    console.error('Error fetching leaf categories:', error)
    return { success: false, message: error instanceof Error ? error.message : 'Operation failed' }
  } finally {
    await session.close()
  }
}

/**
 * Get leaf categories by hierarchy
 */
export async function getLeafCategoriesByHierarchyAction(
  hierarchy: string
) {
  const session = getSession()
  try {
    const categories = await categoryRepo.getLeafCategoriesByHierarchy(session, hierarchy)
    return { success: true, data: categories }
  } catch (error: unknown) {
    console.error('Error fetching leaf categories by hierarchy:', error)
    return { success: false, message: error instanceof Error ? error.message : 'Operation failed' }
  } finally {
    await session.close()
  }
}

/**
 * Validate if category can accept products (is a leaf)
 */
export async function validateLeafCategoryAction(categoryId: string) {
  const session = getSession()
  try {
    const validation = await categoryRepo.validateLeafCategoryForProduct(session, categoryId)
    return { success: true, data: validation }
  } catch (error: unknown) {
    console.error('Error validating category:', error)
    return { success: false, message: error instanceof Error ? error.message : 'Operation failed' }
  } finally {
    await session.close()
  }
}

/**
 * Assign product to categories (Admin only)
 * IMPORTANT: Only leaf categories (without children) can have products
 */
export async function assignProductToCategoriesAction(
  productId: string,
  categoryIds: string[]
) {
  if (!(await isAdmin())) {
    return { success: false, message: 'Unauthorized' }
}

  const session = getSession()
  try {
    await categoryRepo.assignProductToCategories(session, productId, categoryIds)
    return { success: true }
  } catch (error: unknown) {
    console.error('Error assigning product to categories:', error)
    return { success: false, message: error instanceof Error ? error.message : 'Operation failed' }
  } finally {
    await session.close()
  }
}

/**
 * Get products for a specific category with full details (Admin only)
 */
export async function getCategoryProductsAction(categoryId: string) {
  if (!(await isAdmin())) {
    return { success: false, message: 'Unauthorized' }
}

  const session = getSession()
  try {
    const result = await session.run(
      `MATCH (p:Product)-[:HAS_CATEGORY]->(c:Category {id: $categoryId})
       OPTIONAL MATCH (v:ProductVariant)-[:VARIANT_OF]->(p)
       WITH p, collect(v {.*}) as variants
       RETURN p {.*, variants: variants}
       ORDER BY p.name`,
      { categoryId }
    )

    const products = result.records.map(record => convertNeo4jIntegers(record.get('p')))
    return { success: true, data: products }
  } catch (error: unknown) {
    console.error('Error fetching category products:', error)
    return { success: false, message: error instanceof Error ? error.message : 'Operation failed' }
  } finally {
    await session.close()
  }
}

/**
 * Remove product from a category (Admin only)
 */
export async function removeProductFromCategoryAction(
  productId: string,
  categoryId: string
) {
  if (!(await isAdmin())) {
    return { success: false, message: 'Unauthorized' }
}

  const session = getSession()
  try {
    await session.run(
      `MATCH (p:Product {id: $productId})-[r:HAS_CATEGORY]->(c:Category {id: $categoryId})
       DELETE r`,
      { productId, categoryId }
    )
    return { success: true }
  } catch (error: unknown) {
    console.error('Error removing product from category:', error)
    return { success: false, message: error instanceof Error ? error.message : 'Operation failed' }
  } finally {
    await session.close()
  }
}

/**
 * Add product to a category (Admin only)
 */
export async function addProductToCategoryAction(
  productId: string,
  categoryId: string
) {
  if (!(await isAdmin())) {
    return { success: false, message: 'Unauthorized' }
}

  const session = getSession()
  try {
    // Validate category is a leaf
    const validation = await categoryRepo.validateLeafCategoryForProduct(session, categoryId)
    if (!validation.valid) {
      return { success: false, message: validation.error }
    }

    // Check if relationship already exists
    const existingResult = await session.run(
      `MATCH (p:Product {id: $productId})-[r:HAS_CATEGORY]->(c:Category {id: $categoryId})
       RETURN r`,
      { productId, categoryId }
    )

    if (existingResult.records.length > 0) {
      return { success: false, message: 'Product is already assigned to this category' }
    }

    // Create relationship
    await session.run(
      `MATCH (p:Product {id: $productId})
       MATCH (c:Category {id: $categoryId})
       CREATE (p)-[:HAS_CATEGORY]->(c)`,
      { productId, categoryId }
    )

    return { success: true }
  } catch (error: unknown) {
    console.error('Error adding product to category:', error)
    return { success: false, message: error instanceof Error ? error.message : 'Operation failed' }
  } finally {
    await session.close()
  }
}

/**
 * Get all products that are NOT assigned to a specific category (Admin only)
 */
export async function getUnassignedProductsAction(categoryId: string) {
  if (!(await isAdmin())) {
    return { success: false, message: 'Unauthorized' }
}

  const session = getSession()
  try {
    const result = await session.run(
      `MATCH (p:Product)
       WHERE NOT EXISTS {
         MATCH (p)-[:HAS_CATEGORY]->(c:Category {id: $categoryId})
       }
       OPTIONAL MATCH (v:ProductVariant)-[:VARIANT_OF]->(p)
       WITH p, collect(v {.*}) as variants
       RETURN p {.*, variants: variants}
       ORDER BY p.name
       LIMIT 100`,
      { categoryId }
    )

    const products = result.records.map(record => convertNeo4jIntegers(record.get('p')))
    return { success: true, data: products }
  } catch (error: unknown) {
    console.error('Error fetching unassigned products:', error)
    return { success: false, message: error instanceof Error ? error.message : 'Operation failed' }
  } finally {
    await session.close()
  }
}

/**
 * Get categories for a product
 */
export async function getCategoriesForProductAction(productId: string) {
  const session = getSession()
  try {
    const categoryIds = await categoryRepo.getCategoriesForProduct(session, productId)
    return { success: true, data: categoryIds }
  } catch (error: unknown) {
    console.error('Error fetching product categories:', error)
    return { success: false, message: error instanceof Error ? error.message : 'Operation failed' }
  } finally {
    await session.close()
  }
}
