import { getTranslations } from 'next-intl/server'
import { getProductsAction } from '@/app/actions/products'
import {
  getPromotionalCategoryBySlugAction,
  getProductsByCategoryAction,
} from '@/app/actions/promotional-categories'
import {
  getFullProductsByCategoriesAction,
  getCategoryByIdAction,
  resolveCategoryParamsAction,
} from '@/app/actions/categories'
import ProductGrid from '@/components/products/ProductGrid'
import type { v1 } from '@softx/contract'

export default async function ShopPage({
  searchParams,
}: {
  searchParams: Promise<{ promo?: string; category?: string; search?: string }>
}) {
  const t = await getTranslations('shop')
  const params = await searchParams
  const promoSlug = params.promo
  const categoryParam = params.category
  // LKD-6: the hero search pushes ?search= — filter on it instead of
  // listing the whole catalog (repo search = CONTAINS on name/brand).
  const searchParam = params.search?.trim() || null

  let products: v1.ProductDTO[] = []
  let promoCategory: v1.PromotionalCategoryDTO | null = null
  let categoryTitle: string | null = null

  // Category-based filtering
  if (categoryParam) {
    // LKD-30: accept slugs (deep links like ?category=gents) as well as IDs
    const rawValues = categoryParam.split(',').filter(Boolean)
    const resolved = await resolveCategoryParamsAction(rawValues)
    const categoryIds = resolved.success && resolved.data ? resolved.data : rawValues
    if (categoryIds.length > 0) {
      const result = await getFullProductsByCategoriesAction(categoryIds)
      if (result.success && result.data) {
        products = result.data
      }
      // Get the category name for header display
      if (categoryIds.length === 1) {
        const catResult = await getCategoryByIdAction(categoryIds[0])
        if (catResult.success && catResult.data) {
          categoryTitle = catResult.data.name
        }
      } else {
        categoryTitle = t('filteredProducts')
      }
    }
  }

  // Promotional category filtering
  if (!categoryParam && promoSlug) {
    const catResult = await getPromotionalCategoryBySlugAction(promoSlug)
    if (catResult.success && catResult.data) {
      promoCategory = catResult.data
      const prodResult = await getProductsByCategoryAction(promoCategory.id)
      products = prodResult.data || []
    }
  }

  // Default: all products, or the ?search= matches when present
  if (!categoryParam && (!promoSlug || !promoCategory)) {
    const result = searchParam
      ? await getProductsAction({ search: searchParam })
      : await getProductsAction()
    products = result.products
  }

  const headerTitle = categoryTitle || (promoCategory ? promoCategory.name : searchParam) || t('title')
  const headerSubtitle = promoCategory?.description || (searchParam ? t('searchResults') : t('subtitle'))

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <h1 className="font-display text-display-sm uppercase text-black-700">
            {headerTitle}
          </h1>
          <p className="mt-2 text-body text-gray-600">
            {headerSubtitle}
          </p>
        </div>
      </div>

      {/* Products */}
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6 flex items-center justify-between">
          <p className="text-sm text-gray-600">
            {t('productsCount', { count: products.length })}
          </p>
        </div>

        <ProductGrid products={products} />
      </div>
    </div>
  )
}
