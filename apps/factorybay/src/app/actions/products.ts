'use server'

import {
  getAllProducts,
  getProductById,
  searchProducts,
  getAllBrands,
  getProductCount,
  type ProductFilters,
  type ProductWithVariants,
} from '@/lib/repositories/product.repository'

/**
 * Get all products with optional filtering
 */
export async function getProductsAction(filters?: ProductFilters) {
  try {
    const products = await getAllProducts(filters)
    const count = await getProductCount(filters)

    return {
      success: true,
      products,
      count,
    }
  } catch (error) {
    console.error('Get products error:', error)
    return {
      success: false,
      products: [],
      count: 0,
      error: 'Failed to fetch products',
    }
  }
}

/**
 * Get a single product by ID
 */
export async function getProductAction(id: string) {
  try {
    const product = await getProductById(id)

    if (!product) {
      return {
        success: false,
        product: null,
        error: 'Product not found',
      }
    }

    return {
      success: true,
      product,
    }
  } catch (error) {
    console.error('Get product error:', error)
    return {
      success: false,
      product: null,
      error: 'Failed to fetch product',
    }
  }
}

/**
 * Search products
 */
export async function searchProductsAction(query: string) {
  try {
    const products = await searchProducts(query)

    return {
      success: true,
      products,
    }
  } catch (error) {
    console.error('Search products error:', error)
    return {
      success: false,
      products: [],
      error: 'Failed to search products',
    }
  }
}

/**
 * Get all available brands
 */
export async function getBrandsAction() {
  try {
    const brands = await getAllBrands()

    return {
      success: true,
      brands,
    }
  } catch (error) {
    console.error('Get brands error:', error)
    return {
      success: false,
      brands: [],
      error: 'Failed to fetch brands',
    }
  }
}
