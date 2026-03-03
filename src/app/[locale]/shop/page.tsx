import { getTranslations } from 'next-intl/server'
import { getProductsAction } from '@/app/actions/products'
import {
  getPromotionalCategoryBySlugAction,
  getProductsByCategoryAction,
} from '@/app/actions/promotional-categories'
import {
  getFullProductsByCategoriesAction,
  getCategoryByIdAction,
} from '@/app/actions/categories'
import ProductGrid from '@/components/products/ProductGrid'
import { ProductWithVariants } from '@/lib/repositories/product.repository'
import { PromotionalCategory } from '@/lib/types'

export default async function ShopPage({
  searchParams,
}: {
  searchParams: Promise<{ promo?: string; category?: string }>
}) {
  const t = await getTranslations('shop')
  const params = await searchParams
  const promoSlug = params.promo
  const categoryParam = params.category

  let products: ProductWithVariants[] = []
  let promoCategory: PromotionalCategory | null = null
  let categoryTitle: string | null = null

  // Category-based filtering
  if (categoryParam) {
    const categoryIds = categoryParam.split(',').filter(Boolean)
    if (categoryIds.length > 0) {
      const result = await getFullProductsByCategoriesAction(categoryIds)
      if (result.success && result.data) {
        products = result.data as ProductWithVariants[]
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

  // Default: show all products
  if (!categoryParam && (!promoSlug || !promoCategory)) {
    const result = await getProductsAction()
    products = result.products
  }

  const headerTitle = categoryTitle || (promoCategory ? promoCategory.name : t('title'))
  const headerSubtitle = promoCategory?.description || t('subtitle')

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <h1 className="text-3xl font-bold text-black-700">
            {headerTitle}
          </h1>
          <p className="mt-2 text-gray-600">
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
