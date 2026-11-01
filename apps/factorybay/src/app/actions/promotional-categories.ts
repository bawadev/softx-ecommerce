'use server'

import { internal } from '@softx/engine'
import { getCurrentUser } from '@/lib/auth'
import { ActionResponse } from '@softx/engine'
import { ProductWithVariants } from '@softx/engine'
import { PromotionalCategory } from '@softx/engine'
import type { v1 } from '@softx/contract'
import { getCatalog, getAdminCatalog, currentActor } from '@/lib/engine'

// Joined promo reads with no contract home go through the engine's narrow
// internal escape hatch (see packages/engine/src/index.ts for the audited
// consumer list).
const promoCategoryRepo = internal.repositories.promotionalCategoryRepository
const { getSession } = internal.db

/** Failed service Result → the action's envelope message (UNAUTHORIZED keeps this family's exact string). */
function resultMessage(r: { error: { code: string; message: string } }): string {
  return r.error.code === 'UNAUTHORIZED' ? 'Unauthorized. Admin access required.' : r.error.message
}

/**
 * Create a new promotional category (Admin only — enforced engine-side via the actor)
 */
export async function createPromotionalCategoryAction(data: v1.PromotionalCategoryWriteInput): Promise<ActionResponse<v1.PromotionalCategoryDTO>> {
  try {
    const r = await getAdminCatalog().createPromotionalCategory(await currentActor(), data)

    if (!r.ok) {
      return { success: false, message: resultMessage(r) }
    }

    return {
      success: true,
      message: 'Promotional category created successfully',
      data: r.data,
    }
  } catch (error: any) {
    console.error('Error creating promotional category:', error)
    return { success: false, message: error.message || 'Failed to create promotional category' }
  }
}

/**
 * Get all promotional categories
 */
export async function getAllPromotionalCategoriesAction(
  activeOnly = false
): Promise<ActionResponse<v1.PromotionalCategoryDTO[]>> {
  try {
    const r = await getCatalog().listPromotionalCategories(!activeOnly)
    if (!r.ok) {
      return { success: false, message: r.error.message || 'Failed to fetch promotional categories' }
    }

    return {
      success: true,
      data: r.data,
    }
  } catch (error: any) {
    console.error('Error fetching promotional categories:', error)
    return { success: false, message: error.message || 'Failed to fetch promotional categories' }
  }
}

/**
 * Get promotional category by ID
 */
export async function getPromotionalCategoryByIdAction(
  categoryId: string
): Promise<ActionResponse<v1.PromotionalCategoryDTO>> {
  try {
    // The engine contract has no by-id lookup; list everything (including
    // inactive) and find by id.
    const r = await getCatalog().listPromotionalCategories(true)
    if (!r.ok) {
      return { success: false, message: r.error.message || 'Failed to fetch promotional category' }
    }

    const category = r.data.find((c) => c.id === categoryId)
    if (!category) {
      return { success: false, message: 'Promotional category not found' }
    }

    return {
      success: true,
      data: category,
    }
  } catch (error: any) {
    console.error('Error fetching promotional category:', error)
    return { success: false, message: error.message || 'Failed to fetch promotional category' }
  }
}

/**
 * Get promotional category by slug (public)
 */
export async function getPromotionalCategoryBySlugAction(
  slug: string
): Promise<ActionResponse<v1.PromotionalCategoryDTO>> {
  try {
    const r = await getCatalog().getPromotionalCategoryBySlug(slug)
    if (!r.ok) {
      return { success: false, message: r.error.message || 'Promotional category not found' }
    }

    return {
      success: true,
      data: r.data,
    }
  } catch (error: any) {
    console.error('Error fetching promotional category by slug:', error)
    return { success: false, message: error.message || 'Failed to fetch promotional category' }
  }
}

/**
 * Update promotional category (Admin only — enforced engine-side via the actor)
 */
export async function updatePromotionalCategoryAction(
  categoryId: string,
  data: v1.PromotionalCategoryUpdateInput
): Promise<ActionResponse<v1.PromotionalCategoryDTO>> {
  try {
    const r = await getAdminCatalog().updatePromotionalCategory(await currentActor(), categoryId, data)

    if (!r.ok) {
      return { success: false, message: resultMessage(r) }
    }

    return {
      success: true,
      message: 'Promotional category updated successfully',
      data: r.data,
    }
  } catch (error: any) {
    console.error('Error updating promotional category:', error)
    return { success: false, message: error.message || 'Failed to update promotional category' }
  }
}

/**
 * Delete promotional category (Admin only — enforced engine-side via the actor)
 */
export async function deletePromotionalCategoryAction(
  categoryId: string
): Promise<ActionResponse<void>> {
  try {
    const r = await getAdminCatalog().deletePromotionalCategory(await currentActor(), categoryId)

    if (!r.ok) {
      return { success: false, message: resultMessage(r) }
    }

    return {
      success: true,
      message: 'Promotional category deleted successfully',
    }
  } catch (error: any) {
    console.error('Error deleting promotional category:', error)
    return { success: false, message: error.message || 'Failed to delete promotional category' }
  }
}

/**
 * Add product to promotional category (Admin only — enforced engine-side via the actor)
 */
export async function addProductToCategoryAction(
  categoryId: string,
  productId: string,
  allocatedQuantity: number
): Promise<ActionResponse<void>> {
  try {
    const r = await getAdminCatalog().addProductToPromotionalCategory(
      await currentActor(),
      categoryId,
      productId,
      allocatedQuantity
    )

    if (!r.ok) {
      return { success: false, message: resultMessage(r) }
    }

    return {
      success: true,
      message: 'Product added to category successfully',
    }
  } catch (error: any) {
    console.error('Error adding product to category:', error)
    return { success: false, message: error.message || 'Failed to add product to category' }
  }
}

/**
 * Remove product from promotional category (Admin only — enforced engine-side via the actor)
 */
export async function removeProductFromCategoryAction(
  categoryId: string,
  productId: string
): Promise<ActionResponse<void>> {
  try {
    const r = await getAdminCatalog().removeProductFromPromotionalCategory(
      await currentActor(),
      categoryId,
      productId
    )

    if (!r.ok) {
      return { success: false, message: resultMessage(r) }
    }

    return {
      success: true,
      message: 'Product removed from category successfully',
    }
  } catch (error: any) {
    console.error('Error removing product from category:', error)
    return { success: false, message: error.message || 'Failed to remove product from category' }
  }
}

/**
 * Update product quantity in category (Admin only — enforced engine-side via the actor)
 */
export async function updateCategoryItemQuantityAction(
  categoryId: string,
  productId: string,
  allocatedQuantity: number
): Promise<ActionResponse<void>> {
  try {
    const r = await getAdminCatalog().setPromotionalCategoryQuantity(
      await currentActor(),
      categoryId,
      productId,
      allocatedQuantity
    )

    if (!r.ok) {
      return { success: false, message: resultMessage(r) }
    }

    return {
      success: true,
      message: 'Quantity updated successfully',
    }
  } catch (error: any) {
    console.error('Error updating category item quantity:', error)
    return { success: false, message: error.message || 'Failed to update quantity' }
  }
}

/**
 * Get products in a promotional category
 */
export async function getProductsByCategoryAction(
  categoryId: string,
  limit = 20
): Promise<ActionResponse<v1.ProductDTO[]>> {
  try {
    const r = await getCatalog().listProductsByPromotionalCategory(categoryId)
    if (!r.ok) {
      return { success: false, message: r.error.message || 'Failed to fetch products' }
    }

    return {
      success: true,
      data: r.data.slice(0, limit),
    }
  } catch (error: any) {
    console.error('Error fetching products by category:', error)
    return { success: false, message: error.message || 'Failed to fetch products' }
  }
}

/**
 * Toggle product visibility in a promotional category (Admin only — enforced engine-side via the actor)
 */
export async function toggleProductInCategoryAction(
  categoryId: string,
  productId: string,
  isActive: boolean
): Promise<ActionResponse<void>> {
  try {
    const r = await getAdminCatalog().toggleProductInPromotionalCategory(
      await currentActor(),
      categoryId,
      productId,
      isActive
    )

    if (!r.ok) {
      return { success: false, message: resultMessage(r) }
    }

    return {
      success: true,
      message: `Product ${isActive ? 'shown' : 'hidden'} successfully`,
    }
  } catch (error: any) {
    console.error('Error toggling product in category:', error)
    return { success: false, message: error.message || 'Failed to toggle product visibility' }
  }
}

/**
 * Get category items with details for admin management
 */
export async function getCategoryItemsWithDetailsAction(categoryId: string): Promise<
  ActionResponse<
    Array<{
      product: ProductWithVariants
      allocatedQuantity: number
      soldQuantity: number
      remainingQuantity: number
      isActive: boolean
    }>
  >
> {
  const session = getSession()

  try {
    const user = await getCurrentUser()
    if (!user || user.role !== 'ADMIN') {
      return { success: false, message: 'Unauthorized. Admin access required.' }
    }

    const items = await promoCategoryRepo.getCategoryItemsWithDetails(session, categoryId)

    return {
      success: true,
      data: items,
    }
  } catch (error: any) {
    console.error('Error fetching category items:', error)
    return { success: false, message: error.message || 'Failed to fetch category items' }
  } finally {
    await session.close()
  }
}

/**
 * Get all promotional categories a product belongs to
 */
export async function getProductCategoriesAction(productId: string): Promise<
  ActionResponse<
    Array<{
      category: PromotionalCategory
      allocatedQuantity: number
      soldQuantity: number
      remainingQuantity: number
    }>
  >
> {
  const session = getSession()

  try {
    const user = await getCurrentUser()
    if (!user || user.role !== 'ADMIN') {
      return { success: false, message: 'Unauthorized. Admin access required.' }
    }

    const categories = await promoCategoryRepo.getProductCategories(session, productId)

    return {
      success: true,
      data: categories,
    }
  } catch (error: any) {
    console.error('Error fetching product categories:', error)
    return { success: false, message: error.message || 'Failed to fetch product categories' }
  } finally {
    await session.close()
  }
}

/**
 * Move quantity between categories (Admin only — enforced engine-side via the actor)
 */
export async function moveQuantityBetweenCategoriesAction(
  productId: string,
  fromCategoryId: string,
  toCategoryId: string,
  quantity: number
): Promise<ActionResponse<void>> {
  try {
    const r = await getAdminCatalog().moveQuantity(
      await currentActor(),
      productId,
      fromCategoryId,
      toCategoryId,
      quantity
    )

    if (!r.ok) {
      return { success: false, message: resultMessage(r) }
    }

    return {
      success: true,
      message: 'Quantity moved successfully',
    }
  } catch (error: any) {
    console.error('Error moving quantity between categories:', error)
    return { success: false, message: error.message || 'Failed to move quantity' }
  }
}
