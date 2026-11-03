'use server'

import { isAdmin } from '@/lib/auth'
import { internal, type ProductWithVariants } from '@softx/engine'
import type { ActionResponse } from '@softx/engine'
import type { v1 } from '@softx/contract'
import { getCatalog, getAdminCatalog, currentActor } from '@/lib/engine'

// Edit-form by-id read: repository boundary (MAJOR-unit prices) — the form
// still works in those units, so this read stays on the repository primitive
// until the form retypes onto the contract write inputs (future decision).
const { getProductById } = internal.repositories.productRepository

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
  product: v1.ProductWriteInput,
  variants: v1.VariantWriteInput[]
): Promise<ActionResponse<{ product: v1.ProductDTO }>> {
  try {
    const r = await getAdminCatalog().createProduct(await currentActor(), {
      ...product,
      variants,
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
  updates: v1.ProductUpdateInput
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
 * Add a variant to an existing product (engine addVariant → refreshed ProductDTO)
 */
export async function addVariantAction(
  productId: string,
  variant: v1.VariantWriteInput
): Promise<ActionResponse<null>> {
  try {
    const r = await getAdminCatalog().addVariant(await currentActor(), productId, variant)

    if (!r.ok) {
      return {
        success: false,
        message: resultMessage(r),
      }
    }

    return {
      success: true,
      message: 'Variant added successfully',
    }
  } catch (error) {
    console.error('Add variant error:', error)
    return {
      success: false,
      message: 'Failed to add variant',
    }
  }
}

/**
 * Update an existing variant (engine updateVariant → refreshed ProductDTO)
 */
export async function updateVariantAction(
  variantId: string,
  updates: v1.VariantUpdateInput
): Promise<ActionResponse<null>> {
  try {
    const r = await getAdminCatalog().updateVariant(await currentActor(), variantId, updates)

    if (!r.ok) {
      return {
        success: false,
        message: resultMessage(r),
      }
    }

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
 * Delete a variant (LKD-11 companion of the edit dialog's remove action).
 *
 * Repository-shaped write on purpose: the contract's AdminCatalogService has no
 * deleteVariant this phase (adding one is a contract-bump decision), so the
 * action guards on the session (isAdmin) and uses the internal repository
 * primitive directly — the same escape hatch as getAdminProductAction above.
 * The repo delete is order-safe (order mapper re-points ITEM_OF edges).
 */
export async function deleteVariantAction(
  variantId: string
): Promise<ActionResponse<null>> {
  const adminAccess = await isAdmin()

  if (!adminAccess) {
    return {
      success: false,
      message: 'Unauthorized',
    }
  }

  try {
    const { deleteVariant } = internal.repositories.productRepository
    await deleteVariant(variantId)

    return {
      success: true,
      message: 'Variant deleted successfully',
    }
  } catch (error) {
    console.error('Delete variant error:', error)
    return {
      success: false,
      message: 'Failed to delete variant',
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
