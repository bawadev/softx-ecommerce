import type { Product, ProductWithVariants } from '@softx/engine'
import type { FormData } from '@/components/admin/ProductFormDialog'

/**
 * Admin product form mappers.
 *
 * The admin product form still talks to the repository write actions
 * (create/updateProductAction take repository Product shapes), while the
 * product list it edits from is served as v1.ProductDTO by the engine read
 * path. These mappers keep both translations (repository product → form,
 * form → repository write payload) in one non-UI module so components only
 * deal in DTOs and form values. Collapses when the write path moves to the
 * engine (Phase 5).
 */

export function emptyProductForm(): FormData {
  return {
    name: '',
    description: '',
    brand: '',
    categoryIds: [],
    gender: 'UNISEX',
    stockPrice: '',
    retailPrice: '',
    sku: '',
    images: [],
  }
}

export function repositoryProductToForm(p: ProductWithVariants, categoryIds: string[]): FormData {
  return {
    name: p.name,
    description: p.description,
    brand: p.brand,
    categoryIds,
    gender: p.gender,
    stockPrice: p.stockPrice.toString(),
    retailPrice: p.retailPrice.toString(),
    sku: p.sku,
    images: p.images || [],
  }
}

export type FormPrices = { stock: number; retail: number }

/** Parse + validate the form's price inputs; null when invalid or non-positive. */
export function parseFormPrices(form: FormData): FormPrices | null {
  const stock = parseFloat(form.stockPrice)
  const retail = parseFloat(form.retailPrice)
  if (isNaN(stock) || isNaN(retail) || stock <= 0 || retail <= 0) {
    return null
  }
  return { stock, retail }
}

export function formToUpdatePayload(
  form: FormData,
  prices: FormPrices
): Partial<Omit<Product, 'id' | 'createdAt' | 'updatedAt'>> {
  return {
    name: form.name.trim(),
    description: form.description.trim(),
    brand: form.brand.trim(),
    gender: form.gender,
    stockPrice: prices.stock,
    retailPrice: prices.retail,
    sku: form.sku.trim(),
    images: form.images || [],
  }
}

export function formToCreatePayload(
  form: FormData,
  prices: FormPrices,
  sku: string
): Omit<Product, 'id' | 'createdAt' | 'updatedAt'> {
  return {
    name: form.name.trim(),
    description: form.description.trim(),
    brand: form.brand.trim(),
    gender: form.gender,
    stockPrice: prices.stock,
    retailPrice: prices.retail,
    sku,
    images: form.images || [],
  }
}
