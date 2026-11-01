'use server'

import { getSession } from '@softx/engine'
import { isAdmin } from '@/lib/auth'
import { convertNeo4jIntegers } from '@softx/engine'
import * as categoryRepo from '@softx/engine'
import type { v1 } from '@softx/contract'
import { getCatalog, getAdminCatalog, currentActor } from '@/lib/engine'

/** Failed service Result → the action's envelope message (UNAUTHORIZED keeps this family's exact string). */
function resultMessage(r: { error: { code: string; message: string } }): string {
  return r.error.code === 'UNAUTHORIZED' ? 'Unauthorized' : r.error.message
}

/**
 * Collect nodes matching a predicate across the whole tree (depth-first).
 */
function collectFromTree(
  nodes: v1.CategoryTreeDTO[],
  predicate: (node: v1.CategoryTreeDTO) => boolean
): v1.CategoryDTO[] {
  const out: v1.CategoryDTO[] = []
  const walk = (list: v1.CategoryTreeDTO[]) => {
    for (const node of list) {
      if (predicate(node)) {
        out.push(node)
      }
      walk(node.children)
    }
  }
  walk(nodes)
  return out
}

/**
 * Find a node (and its children) anywhere in the tree.
 */
function findInTree(
  nodes: v1.CategoryTreeDTO[],
  id: string
): v1.CategoryTreeDTO | null {
  for (const node of nodes) {
    if (node.id === id) return node
    const hit = findInTree(node.children, id)
    if (hit) return hit
  }
  return null
}

/**
 * Get all root categories (Ladies, Gents, Kids)
 */
export async function getRootCategoriesAction() {
  try {
    // getCategoryTree() returns the root nodes (level 0 / parentId null) with nested children
    const r = await getCatalog().getCategoryTree()
    if (!r.ok) {
      return { success: false, message: r.error.message }
    }
    return { success: true, data: r.data }
  } catch (error: unknown) {
    console.error('Error fetching root categories:', error)
    return { success: false, message: error instanceof Error ? error.message : 'Failed to fetch root categories' }
  }
}

/**
 * Get complete category tree
 */
export async function getCategoryTreeAction() {
  try {
    // v1 tree: flat array of root CategoryTreeDTO nodes with nested children
    const r = await getCatalog().getCategoryTree()
    if (!r.ok) {
      return { success: false, message: r.error.message }
    }
    return { success: true, data: r.data }
  } catch (error: unknown) {
    console.error('Error fetching category tree:', error)
    return { success: false, message: error instanceof Error ? error.message : 'Failed to fetch category tree' }
  }
}

/**
 * Get categories by hierarchy
 */
export async function getCategoriesByHierarchyAction(
  hierarchy: string
) {
  try {
    const r = await getCatalog().getCategoryTree()
    if (!r.ok) {
      return { success: false, message: r.error.message }
    }
    return { success: true, data: collectFromTree(r.data, (node) => node.hierarchy === hierarchy) }
  } catch (error: unknown) {
    console.error('Error fetching categories by hierarchy:', error)
    return { success: false, message: error instanceof Error ? error.message : 'Failed to fetch categories' }
  }
}

/**
 * Get category by ID
 */
export async function getCategoryByIdAction(id: string) {
  try {
    const r = await getCatalog().getCategory(id)
    if (!r.ok) {
      return { success: false, message: r.error.message }
    }
    return { success: true, data: r.data }
  } catch (error: unknown) {
    console.error('Error fetching category:', error)
    return { success: false, message: error instanceof Error ? error.message : 'Failed to fetch category' }
  }
}

/**
 * Get child categories
 */
export async function getChildCategoriesAction(parentId: string) {
  try {
    const r = await getCatalog().getCategoryTree()
    if (!r.ok) {
      return { success: false, message: r.error.message }
    }
    const node = findInTree(r.data, parentId)
    return { success: true, data: node ? node.children : [] }
  } catch (error: unknown) {
    console.error('Error fetching child categories:', error)
    return { success: false, message: error instanceof Error ? error.message : 'Failed to fetch child categories' }
  }
}

/**
 * Get child categories with descendant product counts (rolls up from all sub-levels)
 */
export async function getChildCategoriesWithDescendantCountsAction(parentId: string) {
  try {
    const r = await getCatalog().getCategoryTree()
    if (!r.ok) {
      return { success: false, message: r.error.message }
    }
    // Tree nodes carry productCount rolled up across all descendants
    const node = findInTree(r.data, parentId)
    return { success: true, data: node ? node.children : [] }
  } catch (error: unknown) {
    console.error('Error fetching child categories with descendant counts:', error)
    return { success: false, message: error instanceof Error ? error.message : 'Failed to fetch child categories' }
  }
}

/**
 * Get featured categories
 */
export async function getFeaturedCategoriesAction() {
  try {
    const r = await getCatalog().getCategoryTree()
    if (!r.ok) {
      return { success: false, message: r.error.message }
    }
    return { success: true, data: collectFromTree(r.data, (node) => node.isFeatured && node.isActive) }
  } catch (error: unknown) {
    console.error('Error fetching featured categories:', error)
    return { success: false, message: error instanceof Error ? error.message : 'Failed to fetch featured categories' }
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
  try {
    const r = await getAdminCatalog().createCategory(await currentActor(), {
      name,
      hierarchy,
      parentId,
      isFeatured,
    })
    if (!r.ok) {
      return { success: false, message: resultMessage(r) }
    }
    return { success: true, data: r.data }
  } catch (error: unknown) {
    console.error('Error creating category:', error)
    return { success: false, message: error instanceof Error ? error.message : 'Operation failed' }
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
  try {
    const r = await getAdminCatalog().updateCategory(await currentActor(), id, updates)
    if (!r.ok) {
      return { success: false, message: resultMessage(r) }
    }
    return { success: true, data: r.data }
  } catch (error: unknown) {
    console.error('Error updating category:', error)
    return { success: false, message: error instanceof Error ? error.message : 'Operation failed' }
  }
}

/**
 * Delete category (Admin only)
 */
export async function deleteCategoryAction(id: string) {
  try {
    const r = await getAdminCatalog().deleteCategory(await currentActor(), id)
    if (!r.ok) {
      return { success: false, message: r.error.message }
    }
    return { success: true }
  } catch (error: unknown) {
    console.error('Error deleting category:', error)
    return { success: false, message: error instanceof Error ? error.message : 'Operation failed' }
  }
}

/**
 * Get products by categories
 *
 * Returns product IDs (the engine's listProductsByCategories always includes
 * descendant categories, which matches the previous default usage of this action).
 */
export async function getProductsByCategoriesAction(
  categoryIds: string[],
  _includeDescendants: boolean = true
) {
  try {
    const r = await getCatalog().listProductsByCategories(categoryIds)
    if (!r.ok) {
      return { success: false, message: r.error.message }
    }
    return { success: true, data: r.data.map((p) => p.id) }
  } catch (error: unknown) {
    console.error('Error fetching products by categories:', error)
    return { success: false, message: error instanceof Error ? error.message : 'Operation failed' }
  }
}

/**
 * Get full product objects by categories
 */
export async function getFullProductsByCategoriesAction(categoryIds: string[]) {
  try {
    const r = await getCatalog().listProductsByCategories(categoryIds)
    if (!r.ok) {
      return { success: false, message: r.error.message }
    }
    return { success: true, data: r.data }
  } catch (error: unknown) {
    console.error('Error fetching full products by categories:', error)
    return { success: false, message: error instanceof Error ? error.message : 'Operation failed' }
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
 *
 * Replace semantics implemented on top of the VALIDATED single-assign
 * primitive (never the unvalidated bulk): newly selected categories are
 * assigned one-by-one — each call re-enforces the leaf invariant and the
 * duplicate check engine-side — and then deselected categories are removed.
 * Mirrors the old repository bulk's validate-first ordering: an invalid
 * selection fails before any deselection is applied.
 */
export async function assignProductToCategoriesAction(
  productId: string,
  categoryIds: string[]
) {
  const actor = await currentActor()
  const adminCatalog = getAdminCatalog()
  const session = getSession()
  try {
    const existing = await categoryRepo.getCategoriesForProduct(session, productId)
    const selected = new Set(categoryIds)

    for (const categoryId of categoryIds) {
      if (!existing.includes(categoryId)) {
        const r = await adminCatalog.assignProductToCategory(actor, productId, categoryId)
        if (!r.ok) {
          return { success: false, message: resultMessage(r) }
        }
      }
    }

    for (const categoryId of existing) {
      if (!selected.has(categoryId)) {
        const r = await adminCatalog.removeProductFromCategory(actor, productId, categoryId)
        if (!r.ok) {
          return { success: false, message: resultMessage(r) }
        }
      }
    }

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
  try {
    const r = await getAdminCatalog().removeProductFromCategory(
      await currentActor(),
      productId,
      categoryId
    )
    if (!r.ok) {
      return { success: false, message: resultMessage(r) }
    }
    return { success: true }
  } catch (error: unknown) {
    console.error('Error removing product from category:', error)
    return { success: false, message: error instanceof Error ? error.message : 'Operation failed' }
  }
}

/**
 * Add product to a category (Admin only)
 */
export async function addProductToCategoryAction(
  productId: string,
  categoryId: string
) {
  try {
    // Engine-side: leaf validation + duplicate-assignment rejection, with
    // this action's exact messages.
    const r = await getAdminCatalog().assignProductToCategory(
      await currentActor(),
      productId,
      categoryId
    )
    if (!r.ok) {
      return { success: false, message: resultMessage(r) }
    }
    return { success: true }
  } catch (error: unknown) {
    console.error('Error adding product to category:', error)
    return { success: false, message: error instanceof Error ? error.message : 'Operation failed' }
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
