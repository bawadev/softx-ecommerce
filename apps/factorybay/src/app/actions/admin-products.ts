'use server'

import { isAdmin } from '@/lib/auth'
import {
  getProductById,
  updateVariant,
  type ProductWithVariants,
} from '@softx/engine'
import type { ActionResponse, Product, ProductVariant } from '@softx/engine'
import type { v1 } from '@softx/contract'
import { getCatalog, getAdminCatalog, currentActor } from '@/lib/engine'

/** Failed service Result → the action's envelope message (UNAUTHORIZED keeps this family's exact string). */
function resultMessage(r: { error: { code: string; message: string } }): string {
  return r.error.code === 'UNAUTHORIZED' ? 'Unauthorized' : r.error.message
}

/**
 * Get all products for admin view (engine catalog read → v1.ProductDTO)
 */
export async function getAdminProductsAction(): Promise<
  ActionResponse<{ products: v1.ProductDTO[] }>
> {
  const adminAccess = await isAdmin()

  if (!adminAccess) {
    return {
      success: false,
      message: 'Unauthorized',
    }
  }

  try {
    const r = await getCatalog().listProducts({ limit: 100 }) // Get up to 100 products
    if (!r.ok) {
      return {
        success: false,
        message: 'Failed to fetch products',
      }
    }

    return {
      success: true,
      data: { products: r.data.items },
    }
  } catch (error) {
    console.error('Get admin products error:', error)
    return {
      success: false,
      message: 'Failed to fetch products',
    }
  }
}

/**
 * Get a single product for admin editing
 *
 * Repository-shaped read on purpose: the write-path form
 * (repositoryProductToForm) works in the repository boundary's MAJOR-unit
 * prices, which the contract's Money-based ProductDTO cannot express. Moves
 * when the form retypes onto the contract write inputs (Phase 5 Task 7).
 */
export async function getAdminProductAction(
  productId: string
): Promise<ActionResponse<{ product: ProductWithVariants }>> {
  const adminAccess = await isAdmin()

  if (!adminAccess) {
    return {
      success: false,
      message: 'Unauthorized',
    }
  }

  try {
    const product = await getProductById(productId)

    if (!product) {
      return {
        success: false,
        message: 'Product not found',
      }
    }

    return {
      success: true,
      data: { product },
    }
  } catch (error) {
    console.error('Get admin product error:', error)
    return {
      success: false,
      message: 'Failed to fetch product',
    }
  }
}

/**
 * Delete a product
 */
export async function deleteProductAction(
  productId: string
): Promise<ActionResponse<null>> {
  try {
    const r = await getAdminCatalog().deleteProduct(await currentActor(), productId)

    if (!r.ok) {
      return {
        success: false,
        message: resultMessage(r),
      }
    }

    return {
      success: true,
      message: 'Product deleted successfully',
    }
  } catch (error) {
    console.error('Delete product error:', error)
    return {
      success: false,
      message: 'Failed to delete product',
    }
  }
}

/**
 * Create a new product with variants
 */
export async function createProductAction(
  product: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>,
  variants: Omit<ProductVariant, 'id' | 'productId'>[]
): Promise<ActionResponse<{ product: v1.ProductDTO }>> {
  try {
    const r = await getAdminCatalog().createProduct(await currentActor(), {
      ...product,
      // Variant-level images are dead post-Phase-1 (product-level images
      // only) — the write input carries just size/color/stockQuantity.
      variants: variants.map((variant) => ({
        size: variant.size,
        color: variant.color,
        stockQuantity: variant.stockQuantity,
      })),
    })

    if (!r.ok) {
      return {
        success: false,
        message: resultMessage(r),
      }
    }

    return {
      success: true,
      message: 'Product created successfully',
      data: { product: r.data },
    }
  } catch (error) {
    console.error('Create product error:', error)
    return {
      success: false,
      message: 'Failed to create product',
    }
  }
}

/**
 * Update a product
 */
export async function updateProductAction(
  productId: string,
  updates: Partial<Omit<Product, 'id' | 'createdAt' | 'updatedAt'>>
): Promise<ActionResponse<null>> {
  try {
    const r = await getAdminCatalog().updateProduct(await currentActor(), productId, updates)

    if (!r.ok) {
      return {
        success: false,
        message: resultMessage(r),
      }
    }

    return {
      success: true,
      message: 'Product updated successfully',
    }
  } catch (error) {
    console.error('Update product error:', error)
    return {
      success: false,
      message: 'Failed to update product',
    }
  }
}

/**
 * Search products by name (for autocomplete)
 */
export async function searchProductsByNameAction(
  searchTerm: string
): Promise<ActionResponse<{ products: v1.ProductDTO[] }>> {
  try {
    const r = await getAdminCatalog().searchProductsByName(await currentActor(), searchTerm)

    if (!r.ok) {
      return {
        success: false,
        message: resultMessage(r),
      }
    }

    return {
      success: true,
      data: { products: r.data },
    }
  } catch (error) {
    console.error('Search products error:', error)
    return {
      success: false,
      message: 'Failed to search products',
    }
  }
}

/**
 * Check if a product name already exists (for duplicate checking)
 */
export async function checkProductNameExistsAction(
  name: string,
  excludeId?: string
): Promise<ActionResponse<{ exists: boolean }>> {
  try {
    const r = await getAdminCatalog().checkProductNameExists(await currentActor(), name, excludeId)

    if (!r.ok) {
      return {
        success: false,
        message: resultMessage(r),
      }
    }

    return {
      success: true,
      data: {
        exists: r.data,
      },
    }
  } catch (error) {
    console.error('Check product name error:', error)
    return {
      success: false,
      message: 'Failed to check product name',
    }
  }
}

/**
 * Get all unique brands (for autocomplete)
 */
export async function getAllBrandsAction(): Promise<ActionResponse<{ brands: string[] }>> {
  const adminAccess = await isAdmin()

  if (!adminAccess) {
    return {
      success: false,
      message: 'Unauthorized',
    }
  }

  try {
    const r = await getCatalog().listBrands()

    if (!r.ok) {
      return {
        success: false,
        message: 'Failed to fetch brands',
      }
    }

    return {
      success: true,
      data: { brands: r.data },
    }
  } catch (error) {
    console.error('Get brands error:', error)
    return {
      success: false,
      message: 'Failed to fetch brands',
    }
  }
}

/**
 * Add an image to a product variant
 */
export async function addVariantImageAction(
  variantId: string,
  imageUrl: string
): Promise<ActionResponse<null>> {
  const adminAccess = await isAdmin()

  if (!adminAccess) {
    return {
      success: false,
      message: 'Unauthorized',
    }
  }

  try {
    // Get current variant to access existing images
    const { getVariantById } = await import('@softx/engine')
    const variant = await getVariantById(variantId)

    if (!variant) {
      return {
        success: false,
        message: 'Variant not found',
      }
    }

    // Add new image to existing images
    const updatedImages = [...(variant.images || []), imageUrl]

    await updateVariant(variantId, { images: updatedImages })

    return {
      success: true,
      message: 'Image added successfully',
    }
  } catch (error) {
    console.error('Add variant image error:', error)
    return {
      success: false,
      message: 'Failed to add image',
    }
  }
}

/**
 * Remove an image from a product variant
 */
export async function removeVariantImageAction(
  variantId: string,
  imageUrl: string
): Promise<ActionResponse<null>> {
  const adminAccess = await isAdmin()

  if (!adminAccess) {
    return {
      success: false,
      message: 'Unauthorized',
    }
  }

  try {
    // Get current variant to access existing images
    const { getVariantById } = await import('@softx/engine')
    const variant = await getVariantById(variantId)

    if (!variant) {
      return {
        success: false,
        message: 'Variant not found',
      }
    }

    // Remove image from existing images
    const updatedImages = (variant.images || []).filter(img => img !== imageUrl)

    await updateVariant(variantId, { images: updatedImages })

    return {
      success: true,
      message: 'Image removed successfully',
    }
  } catch (error) {
    console.error('Remove variant image error:', error)
    return {
      success: false,
      message: 'Failed to remove image',
    }
  }
}

/**
 * Add an image to a product (product-level, shared across all variants)
 */
export async function addProductImageAction(
  productId: string,
  imageUrl: string
): Promise<ActionResponse<null>> {
  try {
    const r = await getAdminCatalog().addProductImage(await currentActor(), productId, imageUrl)

    if (!r.ok) {
      return {
        success: false,
        message: resultMessage(r),
      }
    }

    return {
      success: true,
      message: 'Image added to product successfully',
    }
  } catch (error) {
    console.error('Add product image error:', error)
    return {
      success: false,
      message: 'Failed to add image to product',
    }
  }
}

/**
 * Remove an image from a product
 */
export async function removeProductImageAction(
  productId: string,
  imageUrl: string
): Promise<ActionResponse<null>> {
  try {
    const r = await getAdminCatalog().removeProductImage(await currentActor(), productId, imageUrl)

    if (!r.ok) {
      return {
        success: false,
        message: resultMessage(r),
      }
    }

    return {
      success: true,
      message: 'Image removed from product successfully',
    }
  } catch (error) {
    console.error('Remove product image error:', error)
    return {
      success: false,
      message: 'Failed to remove image from product',
    }
  }
}
