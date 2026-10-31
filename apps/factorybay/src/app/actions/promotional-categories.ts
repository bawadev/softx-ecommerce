'use server'

import { getSession } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { ActionResponse, PromotionalCategory } from '@/lib/types'
import * as promoCategoryRepo from '@/lib/repositories/promotional-category.repository'
import { ProductWithVariants } from '@/lib/repositories/product.repository'

/**
 * Create a new promotional category (Admin only)
 */
export async function createPromotionalCategoryAction(data: {
  name: string
  slug: string
  description?: string
  displayOrder: number
  isActive?: boolean
  startDate?: string
  endDate?: string
}): Promise<ActionResponse<PromotionalCategory>> {
  const session = getSession()

  try {
    const user = await getCurrentUser()
    if (!user || user.role !== 'ADMIN') {
      return { success: false, message: 'Unauthorized. Admin access required.' }
    }

    const category = await promoCategoryRepo.createPromotionalCategory(session, data)

    return {
      success: true,
      message: 'Promotional category created successfully',
      data: category,
    }
  } catch (error: any) {
    console.error('Error creating promotional category:', error)
    return { success: false, message: error.message || 'Failed to create promotional category' }
  } finally {
    await session.close()
  }
}

/**
 * Get all promotional categories
 */
export async function getAllPromotionalCategoriesAction(
  activeOnly = false
): Promise<ActionResponse<PromotionalCategory[]>> {
  const session = getSession()

  try {
    const categories = await promoCategoryRepo.getAllPromotionalCategories(session, activeOnly)

    return {
      success: true,
      data: categories,
    }
  } catch (error: any) {
    console.error('Error fetching promotional categories:', error)
    return { success: false, message: error.message || 'Failed to fetch promotional categories' }
  } finally {
    await session.close()
  }
}

/**
 * Get promotional category by ID
 */
export async function getPromotionalCategoryByIdAction(
  categoryId: string
): Promise<ActionResponse<PromotionalCategory>> {
  const session = getSession()

  try {
    const category = await promoCategoryRepo.getPromotionalCategoryById(session, categoryId)

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
  } finally {
    await session.close()
  }
}

/**
 * Get promotional category by slug (public)
 */
export async function getPromotionalCategoryBySlugAction(
  slug: string
): Promise<ActionResponse<PromotionalCategory>> {
  const session = getSession()

  try {
    const category = await promoCategoryRepo.getPromotionalCategoryBySlug(session, slug)

    if (!category) {
      return { success: false, message: 'Promotional category not found' }
    }

    return {
      success: true,
      data: category,
    }
  } catch (error: any) {
    console.error('Error fetching promotional category by slug:', error)
    return { success: false, message: error.message || 'Failed to fetch promotional category' }
  } finally {
    await session.close()
  }
}

/**
 * Update promotional category (Admin only)
 */
export async function updatePromotionalCategoryAction(
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
): Promise<ActionResponse<PromotionalCategory>> {
  const session = getSession()

  try {
    const user = await getCurrentUser()
    if (!user || user.role !== 'ADMIN') {
      return { success: false, message: 'Unauthorized. Admin access required.' }
    }

    const category = await promoCategoryRepo.updatePromotionalCategory(session, categoryId, data)

    if (!category) {
      return { success: false, message: 'Promotional category not found' }
    }

    return {
      success: true,
      message: 'Promotional category updated successfully',
      data: category,
    }
  } catch (error: any) {
    console.error('Error updating promotional category:', error)
    return { success: false, message: error.message || 'Failed to update promotional category' }
  } finally {
    await session.close()
  }
}

/**
 * Delete promotional category (Admin only)
 */
export async function deletePromotionalCategoryAction(
  categoryId: string
): Promise<ActionResponse<void>> {
  const session = getSession()

  try {
    const user = await getCurrentUser()
    if (!user || user.role !== 'ADMIN') {
      return { success: false, message: 'Unauthorized. Admin access required.' }
    }

    const deleted = await promoCategoryRepo.deletePromotionalCategory(session, categoryId)

    if (!deleted) {
      return { success: false, message: 'Promotional category not found' }
    }

    return {
      success: true,
      message: 'Promotional category deleted successfully',
    }
  } catch (error: any) {
    console.error('Error deleting promotional category:', error)
    return { success: false, message: error.message || 'Failed to delete promotional category' }
  } finally {
    await session.close()
  }
}

/**
 * Add product to promotional category (Admin only)
 */
export async function addProductToCategoryAction(
  categoryId: string,
  productId: string,
  allocatedQuantity: number
): Promise<ActionResponse<void>> {
  const session = getSession()

  try {
    const user = await getCurrentUser()
    if (!user || user.role !== 'ADMIN') {
      return { success: false, message: 'Unauthorized. Admin access required.' }
    }

    await promoCategoryRepo.addProductToCategory(session, categoryId, productId, allocatedQuantity)

    return {
      success: true,
      message: 'Product added to category successfully',
    }
  } catch (error: any) {
    console.error('Error adding product to category:', error)
    return { success: false, message: error.message || 'Failed to add product to category' }
  } finally {
    await session.close()
  }
}

/**
 * Remove product from promotional category (Admin only)
 */
export async function removeProductFromCategoryAction(
  categoryId: string,
  productId: string
): Promise<ActionResponse<void>> {
  const session = getSession()

  try {
    const user = await getCurrentUser()
    if (!user || user.role !== 'ADMIN') {
      return { success: false, message: 'Unauthorized. Admin access required.' }
    }

    const removed = await promoCategoryRepo.removeProductFromCategory(session, categoryId, productId)

    if (!removed) {
      return { success: false, message: 'Product not found in category' }
    }

    return {
      success: true,
      message: 'Product removed from category successfully',
    }
  } catch (error: any) {
    console.error('Error removing product from category:', error)
    return { success: false, message: error.message || 'Failed to remove product from category' }
  } finally {
    await session.close()
  }
}

/**
 * Update product quantity in category (Admin only)
 */
export async function updateCategoryItemQuantityAction(
  categoryId: string,
  productId: string,
  allocatedQuantity: number
): Promise<ActionResponse<void>> {
  const session = getSession()

  try {
    const user = await getCurrentUser()
    if (!user || user.role !== 'ADMIN') {
      return { success: false, message: 'Unauthorized. Admin access required.' }
    }

    const item = await promoCategoryRepo.updateCategoryItemQuantity(
      session,
      categoryId,
      productId,
      allocatedQuantity
    )

    if (!item) {
      return { success: false, message: 'Product not found in category' }
    }

    return {
      success: true,
      message: 'Quantity updated successfully',
    }
  } catch (error: any) {
    console.error('Error updating category item quantity:', error)
    return { success: false, message: error.message || 'Failed to update quantity' }
  } finally {
    await session.close()
  }
}

/**
 * Get products in a promotional category
 */
export async function getProductsByCategoryAction(
  categoryId: string,
  limit = 20
): Promise<ActionResponse<ProductWithVariants[]>> {
  const session = getSession()

  try {
    const products = await promoCategoryRepo.getProductsByCategory(session, categoryId, limit)

    return {
      success: true,
      data: products,
    }
  } catch (error: any) {
    console.error('Error fetching products by category:', error)
    return { success: false, message: error.message || 'Failed to fetch products' }
  } finally {
    await session.close()
  }
}

/**
 * Toggle product visibility in a promotional category (Admin only)
 */
export async function toggleProductInCategoryAction(
  categoryId: string,
  productId: string,
  isActive: boolean
): Promise<ActionResponse<void>> {
  const session = getSession()

  try {
    const user = await getCurrentUser()
    if (!user || user.role !== 'ADMIN') {
      return { success: false, message: 'Unauthorized. Admin access required.' }
    }

    const updated = await promoCategoryRepo.toggleProductInCategory(
      session,
      categoryId,
      productId,
      isActive
    )

    if (!updated) {
      return { success: false, message: 'Product not found in category' }
    }

    return {
      success: true,
      message: `Product ${isActive ? 'shown' : 'hidden'} successfully`,
    }
  } catch (error: any) {
    console.error('Error toggling product in category:', error)
    return { success: false, message: error.message || 'Failed to toggle product visibility' }
  } finally {
    await session.close()
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
 * Move quantity between categories (Admin only)
 */
export async function moveQuantityBetweenCategoriesAction(
  productId: string,
  fromCategoryId: string,
  toCategoryId: string,
  quantity: number
): Promise<ActionResponse<void>> {
  const session = getSession()

  try {
    const user = await getCurrentUser()
    if (!user || user.role !== 'ADMIN') {
      return { success: false, message: 'Unauthorized. Admin access required.' }
    }

    const moved = await promoCategoryRepo.moveQuantityBetweenCategories(
      session,
      productId,
      fromCategoryId,
      toCategoryId,
      quantity
    )

    if (!moved) {
      return {
        success: false,
        message: 'Failed to move quantity. Check if sufficient quantity is available.',
      }
    }

    return {
      success: true,
      message: 'Quantity moved successfully',
    }
  } catch (error: any) {
    console.error('Error moving quantity between categories:', error)
    return { success: false, message: error.message || 'Failed to move quantity' }
  } finally {
    await session.close()
  }
}
