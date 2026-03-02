'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { useTranslations, useLocale } from 'next-intl'
import type { ProductWithVariants } from '@/lib/repositories/product.repository'
import type { PromotionalCategory } from '@/lib/types'
import type { Category } from '@/lib/repositories/category.repository'
import SearchAutocomplete from '@/components/SearchAutocomplete'
import {
  getFeaturedCategoriesAction,
  getProductsByCategoriesAction,
  getFullProductsByCategoriesAction
} from '@/app/actions/categories'

interface HomePageClientProps {
  isAuthenticated: boolean
  recommendations: ProductWithVariants[]
  recentlyViewed: ProductWithVariants[]
  newArrivals: ProductWithVariants[]
  promotionalCategories: Array<{
    category: PromotionalCategory
    products: ProductWithVariants[]
  }>
}

function ProductCard({ product }: { product: ProductWithVariants }) {
  const locale = useLocale()
  const t = useTranslations('common')
  const firstImage = product.variants.find(v => v.images?.length > 0)?.images?.[0]
  const totalStock = product.variants.reduce((sum, v) => sum + v.stockQuantity, 0)
  const discountPercent = Math.round(
    ((product.retailPrice - product.stockPrice) / product.retailPrice) * 100
  )

  return (
    <Link
      href={`/${locale}/product/${product.id}`}
      className="group block bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow"
    >
      <div className="relative aspect-square bg-gray-100">
        {firstImage ? (
          <Image
            src={firstImage}
            alt={product.name}
            fill
            className="object-cover group-hover:scale-105 transition-transform duration-300"
            sizes="(max-width: 768px) 50vw, (max-width: 1024px) 33vw, 25vw"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-gray-400">
            <span className="text-sm">No image</span>
          </div>
        )}
        {discountPercent > 0 && (
          <div className="absolute top-2 right-2 bg-coral-600 text-white px-2 py-1 rounded-full text-xs font-bold">
            {discountPercent}% OFF
          </div>
        )}
      </div>
      <div className="p-2 sm:p-3 md:p-4">
        <h3 className="font-semibold text-gray-900 md:line-clamp-2 text-xs sm:text-sm md:text-base break-words">{product.name}</h3>
        <p className="text-xs sm:text-sm text-gray-600 mt-1">{product.brand}</p>
        <div className="mt-2 flex flex-col sm:flex-row sm:items-baseline gap-0 sm:gap-1 min-w-0">
          <span className="text-sm sm:text-base md:text-lg font-bold text-navy-900 truncate">Rs {product.stockPrice.toFixed(0)}</span>
          <span className="text-[10px] sm:text-xs md:text-sm text-gray-500 line-through truncate">Rs {product.retailPrice.toFixed(0)}</span>
        </div>
        <p className="text-xs text-gray-500 mt-1">
          {totalStock > 0 ? `${totalStock} ${t('inStock')}` : t('outOfStock')}
        </p>
      </div>
    </Link>
  )
}

export default function HomePageClientSimple({
  isAuthenticated,
  recommendations,
  recentlyViewed,
  newArrivals,
  promotionalCategories,
}: HomePageClientProps) {
  const locale = useLocale()
  const router = useRouter()
  const t = useTranslations('home')
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<Set<string>>(new Set())
  const [filteredProducts, setFilteredProducts] = useState<ProductWithVariants[]>([])
  const [featuredCategories, setFeaturedCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(false)

  // Group categories by hierarchy
  const groupedCategories = {
    ladies: featuredCategories.filter(c => c.hierarchy === 'ladies'),
    gents: featuredCategories.filter(c => c.hierarchy === 'gents'),
    kids: featuredCategories.filter(c => c.hierarchy === 'kids')
  }

  useEffect(() => {
    loadFeaturedCategories()
  }, [])

  useEffect(() => {
    if (selectedCategoryIds.size > 0) {
      fetchFilteredProducts()
    } else {
      setFilteredProducts([])
    }
  }, [selectedCategoryIds])

  async function loadFeaturedCategories() {
    const result = await getFeaturedCategoriesAction()
    if (result.success) {
      setFeaturedCategories(result.data || [])
    }
  }

  async function fetchFilteredProducts() {
    setLoading(true)
    const categoryIds = Array.from(selectedCategoryIds)
    const result = await getFullProductsByCategoriesAction(categoryIds)
    if (result.success) {
      setFilteredProducts(result.data || [])
    }
    setLoading(false)
  }

  function toggleCategory(categoryId: string) {
    const newSelected = new Set(selectedCategoryIds)
    if (newSelected.has(categoryId)) {
      newSelected.delete(categoryId)
    } else {
      newSelected.add(categoryId)
    }
    setSelectedCategoryIds(newSelected)
  }

  function clearFilters() {
    setSelectedCategoryIds(new Set())
    setFilteredProducts([])
  }

  // Filter existing sections by selected categories
  const filterProducts = (products: ProductWithVariants[]) => {
    if (selectedCategoryIds.size === 0) return products
    // This would require product IDs to be checked against category assignments
    // For simplicity, we'll show all products when no filter is active
    return products
  }

  const getCategoryBadgeStyle = (level: number) => {
    switch (level) {
      case 0:
        return 'px-4 py-2 text-base font-bold'
      case 1:
        return 'px-3 py-1.5 text-sm font-semibold'
      case 2:
        return 'px-3 py-1.5 text-sm font-medium'
      default:
        return 'px-2 py-1 text-xs font-medium'
    }
  }

  const getHierarchyColor = (hierarchy: string) => {
    switch (hierarchy) {
      case 'ladies':
        return 'bg-pink-100 text-pink-800 hover:bg-pink-200'
      case 'gents':
        return 'bg-blue-100 text-blue-800 hover:bg-blue-200'
      case 'kids':
        return 'bg-green-100 text-green-800 hover:bg-green-200'
      default:
        return 'bg-gray-100 text-gray-800 hover:bg-gray-200'
    }
  }

  const getHierarchyColorSelected = (hierarchy: string) => {
    switch (hierarchy) {
      case 'ladies':
        return 'bg-pink-600 text-white'
      case 'gents':
        return 'bg-blue-600 text-white'
      case 'kids':
        return 'bg-green-600 text-white'
      default:
        return 'bg-navy-600 text-white'
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero Section */}
      <div className="bg-gradient-to-r from-navy-900 to-navy-700 text-white py-12">
        <div className="container mx-auto px-4">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">Ecom</h1>
          <p className="text-xl mb-8">Branded Clothing at Stock Prices</p>

          {/* Search */}
          <div className="max-w-2xl">
            <SearchAutocomplete />
          </div>
        </div>
      </div>

      {/* Category Filter Section */}
      {featuredCategories.length > 0 && (
        <div className="sticky top-0 z-10 bg-white shadow-md py-4">
          <div className="container mx-auto px-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-semibold">Shop by Category</h2>
              {selectedCategoryIds.size > 0 && (
                <button
                  onClick={clearFilters}
                  className="text-sm text-coral-600 hover:text-coral-700 font-medium"
                >
                  Clear All ({selectedCategoryIds.size})
                </button>
              )}
            </div>

            {/* Ladies Categories */}
            {groupedCategories.ladies.length > 0 && (
              <div className="mb-3">
                <div className="text-xs font-semibold text-gray-600 mb-2">👗 LADIES</div>
                <div className="flex flex-wrap gap-2">
                  {groupedCategories.ladies.map(category => (
                    <button
                      key={category.id}
                      onClick={() => toggleCategory(category.id)}
                      className={`${getCategoryBadgeStyle(category.level)} rounded-full transition-all ${
                        selectedCategoryIds.has(category.id)
                          ? getHierarchyColorSelected('ladies')
                          : getHierarchyColor('ladies')
                      }`}
                    >
                      {category.name}
                      {category.productCount && category.productCount > 0 && (
                        <span className="ml-1 text-xs opacity-75">({category.productCount})</span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Gents Categories */}
            {groupedCategories.gents.length > 0 && (
              <div className="mb-3">
                <div className="text-xs font-semibold text-gray-600 mb-2">👔 GENTS</div>
                <div className="flex flex-wrap gap-2">
                  {groupedCategories.gents.map(category => (
                    <button
                      key={category.id}
                      onClick={() => toggleCategory(category.id)}
                      className={`${getCategoryBadgeStyle(category.level)} rounded-full transition-all ${
                        selectedCategoryIds.has(category.id)
                          ? getHierarchyColorSelected('gents')
                          : getHierarchyColor('gents')
                      }`}
                    >
                      {category.name}
                      {category.productCount && category.productCount > 0 && (
                        <span className="ml-1 text-xs opacity-75">({category.productCount})</span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Kids Categories */}
            {groupedCategories.kids.length > 0 && (
              <div>
                <div className="text-xs font-semibold text-gray-600 mb-2">👶 KIDS</div>
                <div className="flex flex-wrap gap-2">
                  {groupedCategories.kids.map(category => (
                    <button
                      key={category.id}
                      onClick={() => toggleCategory(category.id)}
                      className={`${getCategoryBadgeStyle(category.level)} rounded-full transition-all ${
                        selectedCategoryIds.has(category.id)
                          ? getHierarchyColorSelected('kids')
                          : getHierarchyColor('kids')
                      }`}
                    >
                      {category.name}
                      {category.productCount && category.productCount > 0 && (
                        <span className="ml-1 text-xs opacity-75">({category.productCount})</span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="container mx-auto px-4 py-8">
        {/* Filtered Products Section */}
        {selectedCategoryIds.size > 0 && (
          <section className="mb-12">
            <h2 className="text-2xl font-bold mb-6">
              Filtered Products ({filteredProducts.length})
            </h2>
            {loading ? (
              <div className="text-center py-12 text-gray-500">Loading products...</div>
            ) : filteredProducts.length > 0 ? (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                {filteredProducts.map(product => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </div>
            ) : (
              <div className="text-center py-12 text-gray-500">
                No products found for selected categories
              </div>
            )}
          </section>
        )}

        {/* Promotional Categories */}
        {promotionalCategories.length > 0 &&
          selectedCategoryIds.size === 0 &&
          promotionalCategories.map(({ category, products }) => (
            <section key={category.id} className="mb-12">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-2xl font-bold">{category.name}</h2>
                  {category.description && (
                    <p className="text-gray-600 mt-1">{category.description}</p>
                  )}
                </div>
                <Link
                  href={`/${locale}/shop?promo=${category.slug}`}
                  className="text-navy-600 hover:text-navy-800 font-medium"
                >
                  View All →
                </Link>
              </div>
              {products.length > 0 ? (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                  {products.slice(0, 10).map(product => (
                    <ProductCard key={product.id} product={product} />
                  ))}
                </div>
              ) : (
                <p className="text-gray-500">No products in this category yet.</p>
              )}
            </section>
          ))}

        {/* Recently Viewed */}
        {isAuthenticated && recentlyViewed.length > 0 && selectedCategoryIds.size === 0 && (
          <section className="mb-12">
            <h2 className="text-2xl font-bold mb-6">Recently Viewed</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {filterProducts(recentlyViewed).map(product => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          </section>
        )}

        {/* Recommendations */}
        {isAuthenticated && recommendations.length > 0 && selectedCategoryIds.size === 0 && (
          <section className="mb-12">
            <h2 className="text-2xl font-bold mb-6">Recommended for You</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {filterProducts(recommendations).map(product => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          </section>
        )}

        {/* New Arrivals */}
        {newArrivals.length > 0 && selectedCategoryIds.size === 0 && (
          <section className="mb-12">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold">New Arrivals</h2>
              <Link
                href={`/${locale}/shop?sort=newest`}
                className="text-navy-600 hover:text-navy-800 font-medium"
              >
                View All →
              </Link>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {filterProducts(newArrivals)
                .slice(0, 10)
                .map(product => (
                  <ProductCard key={product.id} product={product} />
                ))}
            </div>
          </section>
        )}

        {/* CTA Section */}
        <section className="bg-gradient-to-r from-navy-900 to-navy-700 text-white rounded-lg p-8 text-center">
          <h2 className="text-3xl font-bold mb-4">Start Exploring</h2>
          <p className="text-lg mb-6">Discover thousands of branded items at unbeatable prices</p>
          <Link
            href={`/${locale}/shop`}
            className="inline-block bg-coral-600 hover:bg-coral-700 text-white font-bold px-8 py-3 rounded-lg transition-colors"
          >
            Browse All Products
          </Link>
        </section>
      </div>
    </div>
  )
}
