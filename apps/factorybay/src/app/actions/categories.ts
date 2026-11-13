'use server'

import { internal } from '@softx/engine'
import { isAdmin } from '@/lib/auth'
import type { v1 } from '@softx/contract'
import { getCatalog, getAdminCatalog, currentActor } from '@/lib/engine'

// Reads with no contract home go through the engine's narrow internal escape
// hatch (see packages/engine/src/index.ts for the audited consumer list).
const categoryRepo = internal.repositories.categoryRepository
const { getSession } = internal.db
const { convertNeo4jIntegers } = internal.neo4jUtils

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
 * Resolve ?category= values to category IDs (LKD-30).
 *
 * The shop page's category filter takes IDs, but humans and external links
 * reasonably type slugs (?category=gents) — those used to render "0 products".
 * Values that already look like UUIDs pass through; anything else is matched
 * case-insensitively against slugs in the tree.
 */
export async function resolveCategoryParamsAction(values: string[]) {
  try {
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    const passthrough: string[] = []
    const slugs = new Set<string>()
    for (const value of values) {
      const v = value.trim()
      if (!v) continue
      if (UUID_RE.test(v)) passthrough.push(v.toLowerCase())
      else slugs.add(v.toLowerCase())
    }

    const resolved = new Set(passthrough)
    if (slugs.size > 0) {
      const r = await getCatalog().getCategoryTree()
      if (!r.ok) {
        return { success: false, message: r.error.message }
      }
      const bySlug = collectFromTree(
        r.data,
        (node) => node.isActive && slugs.has(node.slug.toLowerCase())
      )
      for (const node of bySlug) resolved.add(node.id)
    }

    return { success: true, data: Array.from(resolved) }
  } catch (error: unknown) {
    console.error('Error resolving category params:', error)
    return { success: false, message: error instanceof Error ? error.message : 'Failed to resolve categories' }
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
 * Assign product to categories (Admin only)
 * IMPORTANT: Only leaf categories (without children) can have products
 *
 * Replace semantics on top of the VALIDATED single-assign primitive (never
 * the unvalidated bulk): the (deduplicated) newly selected categories are
 * pre-validated as leaves BEFORE any mutation — so an invalid selection
 * fails with the engine's message before a single add or deselection is
 * applied, never mid-loop after a partial application — then assigned
 * one-by-one (each call re-enforces the leaf invariant and the duplicate
 * check engine-side), and finally deselected categories are removed.
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
    // Dedupe the selection: a repeated id would otherwise hit the engine's
    // duplicate-assignment rejection on its second pass.
    const toAssign = [...new Set(categoryIds)].filter((id) => !existing.includes(id))
    const selected = new Set(categoryIds)

    // Pre-validate every NEW assignment (leaf invariant) before mutating —
    // the old repository bulk's validate-first ordering, restored app-side.
    for (const categoryId of toAssign) {
      const validation = await categoryRepo.validateLeafCategoryForProduct(session, categoryId)
      if (!validation.valid) {
        return { success: false, message: validation.error || 'Invalid category selection' }
      }
    }

    for (const categoryId of toAssign) {
      const r = await adminCatalog.assignProductToCategory(actor, productId, categoryId)
      if (!r.ok) {
        return { success: false, message: resultMessage(r) }
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
