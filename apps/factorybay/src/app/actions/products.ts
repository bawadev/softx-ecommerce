'use server'

import { getCatalog } from '@/lib/engine'
import type { ProductFilters } from '@softx/engine'

/**
 * Get all products with optional filtering
 */
export async function getProductsAction(filters?: ProductFilters) {
  const r = await getCatalog().listProducts(filters)
  if (!r.ok) {
    console.error('Get products error:', r.error)
    return {
      success: false as const,
      products: [],
      count: 0,
      error: r.error.message,
    }
  }
  return {
    success: true as const,
    products: r.data.items,
    count: r.data.total,
  }
}

/**
 * Get a single product by ID
 */
export async function getProductAction(id: string) {
  const r = await getCatalog().getProduct(id)
  if (!r.ok) {
    console.error('Get product error:', r.error)
    return {
      success: false as const,
      product: null,
      error: r.error.message,
    }
  }
  return {
    success: true as const,
    product: r.data,
  }
}

/**
 * Search products
 */
export async function searchProductsAction(query: string) {
  const r = await getCatalog().searchProducts(query)
  if (!r.ok) {
    console.error('Search products error:', r.error)
    return {
      success: false as const,
      products: [],
      error: r.error.message,
    }
  }
  return {
    success: true as const,
    products: r.data,
  }
}

/**
 * Get all available brands
 */
export async function getBrandsAction() {
  const r = await getCatalog().listBrands()
  if (!r.ok) {
    console.error('Get brands error:', r.error)
    return {
      success: false as const,
      brands: [],
      error: r.error.message,
    }
  }
  return {
    success: true as const,
    brands: r.data,
  }
}
