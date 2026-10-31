'use server'

import { isAdmin } from '@/lib/auth'
import {
  getAllProducts,
  getProductById,
  deleteProduct,
  createProduct,
  updateProduct,
  addVariant,
  updateVariant,
  deleteVariant,
  getAllBrands,
  addProductImage,
  removeProductImage,
  type ProductWithVariants,
} from '@/lib/repositories/product.repository'
import type { ActionResponse, Product, ProductVariant } from '@/lib/types'

/**
 * Get all products for admin view
 */
export async function getAdminProductsAction(): Promise<
  ActionResponse<{ products: ProductWithVariants[] }>
> {
  const adminAccess = await isAdmin()

  if (!adminAccess) {
    return {
      success: false,
      message: 'Unauthorized',
    }
  }

  try {
    const products = await getAllProducts({}, 100) // Get up to 100 products

    return {
      success: true,
      data: { products },
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
  const adminAccess = await isAdmin()

  if (!adminAccess) {
    return {
      success: false,
      message: 'Unauthorized',
    }
  }

  try {
    await deleteProduct(productId)

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
): Promise<ActionResponse<{ product: ProductWithVariants }>> {
  const adminAccess = await isAdmin()

  if (!adminAccess) {
    return {
      success: false,
      message: 'Unauthorized',
    }
  }

  try {
    const newProduct = await createProduct(product, variants)

    return {
      success: true,
      message: 'Product created successfully',
      data: { product: newProduct },
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
  const adminAccess = await isAdmin()

  if (!adminAccess) {
    return {
      success: false,
      message: 'Unauthorized',
    }
  }

  try {
    await updateProduct(productId, updates)

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
 * Update a product variant
 */
export async function updateVariantAction(
  variantId: string,
  updates: Partial<Omit<ProductVariant, 'id' | 'productId'>>
): Promise<ActionResponse<null>> {
  const adminAccess = await isAdmin()

  if (!adminAccess) {
    return {
      success: false,
      message: 'Unauthorized',
    }
  }

  try {
    await updateVariant(variantId, updates)

    return {
      success: true,
      message: 'Variant updated successfully',
    }
  } catch (error) {
    console.error('Update variant error:', error)
    return {
      success: false,
      message: 'Failed to update variant',
    }
  }
}

/**
 * Search products by name (for autocomplete)
 */
export async function searchProductsByNameAction(
  searchTerm: string
): Promise<ActionResponse<{ products: ProductWithVariants[] }>> {
  const adminAccess = await isAdmin()

  if (!adminAccess) {
    return {
      success: false,
      message: 'Unauthorized',
    }
  }

  try {
    const products = await getAllProducts({ search: searchTerm }, 10)

    return {
      success: true,
      data: { products },
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
): Promise<ActionResponse<{ exists: boolean; product?: ProductWithVariants }>> {
  const adminAccess = await isAdmin()

  if (!adminAccess) {
    return {
      success: false,
      message: 'Unauthorized',
    }
  }

  try {
    const products = await getAllProducts({ search: name }, 10)

    // Find exact match (case-insensitive)
    const exactMatch = products.find(
      p => p.name.toLowerCase() === name.toLowerCase() && p.id !== excludeId
    )

    return {
      success: true,
      data: {
        exists: !!exactMatch,
        product: exactMatch,
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
    const brands = await getAllBrands()

    return {
      success: true,
      data: { brands },
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
    const { getVariantById } = await import('@/lib/repositories/product.repository')
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
    const { getVariantById } = await import('@/lib/repositories/product.repository')
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
  const adminAccess = await isAdmin()

  if (!adminAccess) {
    return {
      success: false,
      message: 'Unauthorized',
    }
  }

  try {
    await addProductImage(productId, imageUrl)

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
  const adminAccess = await isAdmin()

  if (!adminAccess) {
    return {
      success: false,
      message: 'Unauthorized',
    }
  }

  try {
    await removeProductImage(productId, imageUrl)

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
