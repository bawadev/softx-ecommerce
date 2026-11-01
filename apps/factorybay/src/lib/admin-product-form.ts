import type { ProductWithVariants } from '@softx/engine'
import type { v1 } from '@softx/contract'
import type { ProductFormData } from '@/components/admin/ProductFormDialog'

/**
 * Admin product form mappers.
 *
 * The form's write payloads are typed by the CONTRACT (ProductWriteInput /
 * ProductUpdateInput carry the repository boundary's MAJOR-unit prices, which
 * is exactly what the form collects). The edit-form READ stays
 * repository-shaped this phase (getAdminProductAction on
 * internal.repositories.productRepository) because the form's initial values
 * come from the same major-unit boundary — retyping that read onto
 * Money-based ProductDTOs is a future contract decision.
 */

export function emptyProductForm(): ProductFormData {
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

export function repositoryProductToForm(p: ProductWithVariants, categoryIds: string[]): ProductFormData {
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
export function parseFormPrices(form: ProductFormData): FormPrices | null {
  const stock = parseFloat(form.stockPrice)
  const retail = parseFloat(form.retailPrice)
  if (isNaN(stock) || isNaN(retail) || stock <= 0 || retail <= 0) {
    return null
  }
  return { stock, retail }
}

export function formToUpdatePayload(
  form: ProductFormData,
  prices: FormPrices
): v1.ProductUpdateInput {
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
  form: ProductFormData,
  prices: FormPrices,
  sku: string
): v1.ProductWriteInput {
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
