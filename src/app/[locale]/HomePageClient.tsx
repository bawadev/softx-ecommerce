'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useTranslations, useLocale } from 'next-intl'
import type { ProductWithVariants } from '@/lib/repositories/product.repository'
import type { PromotionalCategory, HeroSlide } from '@/lib/types'
import type { Category } from '@/lib/repositories/category.repository'
import ProductCard from '@/components/products/ProductCard'
import HeroSlider from '@/components/hero/HeroSlider'
import {
  getRootCategoriesAction,
  getChildCategoriesWithDescendantCountsAction,
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
  heroSlides: HeroSlide[]
}

export default function HomePageClient({
  isAuthenticated,
  recommendations,
  recentlyViewed,
  newArrivals,
  promotionalCategories,
  heroSlides,
}: HomePageClientProps) {
  const locale = useLocale()
  const router = useRouter()
  const t = useTranslations('home')

  // Category state
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<Set<string>>(new Set())
  const [filteredProductIds, setFilteredProductIds] = useState<string[]>([])
  const [filteredProducts, setFilteredProducts] = useState<ProductWithVariants[]>([])
  const [rootCategories, setRootCategories] = useState<Category[]>([])
  const [expandedCategoryId, setExpandedCategoryId] = useState<string | null>(null)
  const [childCategories, setChildCategories] = useState<Category[]>([])

  // Load all root categories dynamically on mount
  useEffect(() => {
    getRootCategoriesAction().then((result) => {
      if (result.success && result.data) {
        setRootCategories(result.data)
      }
    })
  }, [])

  // Fetch products when selected categories change
  useEffect(() => {
    if (selectedCategoryIds.size > 0) {
      const categoryIdsArray = Array.from(selectedCategoryIds)
      // Fetch product IDs for filtering existing sections
      getProductsByCategoriesAction(categoryIdsArray, true).then((result) => {
        if (result.success && result.data) {
          setFilteredProductIds(result.data)
        }
      })
      // Fetch full product objects for dedicated filtered section
      getFullProductsByCategoriesAction(categoryIdsArray).then((result) => {
        if (result.success && result.data) {
          setFilteredProducts(result.data)
        }
      })
    } else {
      setFilteredProductIds([])
      setFilteredProducts([])
    }
  }, [selectedCategoryIds])

  // Handle clicking a root category - expand/collapse to show children
  const handleRootCategoryClick = async (category: Category) => {
    if (expandedCategoryId === category.id) {
      // Clicking the same root category - collapse it
      setExpandedCategoryId(null)
      setChildCategories([])
    } else {
      // Clicking a different root category - expand it and load children
      setExpandedCategoryId(category.id)
      const result = await getChildCategoriesWithDescendantCountsAction(category.id)
      if (result.success && result.data) {
        setChildCategories(result.data)
      }
    }
  }

  // Handle selecting/deselecting a category (for filtering)
  const toggleCategorySelection = (categoryId: string) => {
    const newSelected = new Set(selectedCategoryIds)
    if (newSelected.has(categoryId)) {
      newSelected.delete(categoryId)
    } else {
      newSelected.add(categoryId)
    }
    setSelectedCategoryIds(newSelected)
  }

  // Filter products based on selected categories
  const filterProducts = (products: ProductWithVariants[]) => {
    if (selectedCategoryIds.size === 0) {
      return products
    }
    return products.filter(product => filteredProductIds.includes(product.id))
  }

  // Filter all sections
  const filteredRecommendations = filterProducts(recommendations)
  const filteredRecentlyViewed = filterProducts(recentlyViewed)
  const filteredNewArrivals = filterProducts(newArrivals)
  const filteredPromotionalCategories = promotionalCategories && promotionalCategories.length > 0
    ? promotionalCategories.map(({ category, products }) => ({
        category,
        products: filterProducts(products)
      })).filter(({ products }) => products.length > 0)
    : []

  return (
    <main className="min-h-screen bg-gray-50">
      {/* Hero Section - Animated Slider */}
      <HeroSlider slides={heroSlides} />

      {/* Category Filter */}
      <section className="bg-white border-b border-gray-200 sticky top-0 z-40 shadow-sm">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">{t('shopByCategory')}</h3>
            <div className="flex items-center gap-3">
              {selectedCategoryIds.size > 0 && (
                <button
                  onClick={() => setSelectedCategoryIds(new Set())}
                  className="text-sm text-navy-600 hover:text-navy-700 font-medium"
                >
                  {t('clearAll')} ({selectedCategoryIds.size})
                </button>
              )}
            </div>
          </div>

          {/* Root Category Chips - All Dynamic Hierarchies */}
          <div className="flex flex-wrap gap-3">
            {rootCategories.map((category) => {
              const isExpanded = expandedCategoryId === category.id

              return (
                <button
                  key={category.id}
                  onClick={() => handleRootCategoryClick(category)}
                  className={`
                    px-4 py-2 rounded-full transition-all duration-200
                    flex items-center gap-2 text-base font-bold
                    ${
                      isExpanded
                        ? 'bg-navy-600 text-white shadow-md transform scale-105'
                        : 'bg-white text-gray-700 border-2 border-gray-200 hover:border-navy-400 hover:text-navy-600'
                    }
                  `}
                >
                  <span>{category.name}</span>

                  {/* Product count badge */}
                  {category.productCount !== undefined && category.productCount > 0 && (
                    <span className={`text-xs px-1.5 py-0.5 rounded ${
                      isExpanded
                        ? 'bg-navy-500 text-white'
                        : 'bg-blue-100 text-blue-700'
                    }`}>
                      {category.productCount}
                    </span>
                  )}

                  {/* Expand/Collapse indicator */}
                  <svg
                    className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
              )
            })}
          </div>

          {/* Subcategory Chips - Show when root category is expanded */}
          {expandedCategoryId && childCategories.length > 0 && (
            <div className="mt-4 pl-6 border-l-4 border-navy-300">
              <h4 className="text-sm font-semibold text-gray-600 mb-3">
                {t('subcategories')}:
              </h4>
              <div className="flex flex-wrap gap-2">
                {childCategories.map((childCategory) => {
                  const isSelected = selectedCategoryIds.has(childCategory.id)

                  return (
                    <button
                      key={childCategory.id}
                      onClick={() => toggleCategorySelection(childCategory.id)}
                      className={`
                        px-3 py-1.5 rounded-full transition-all duration-200
                        flex items-center gap-2 text-sm font-medium
                        ${
                          isSelected
                            ? 'bg-navy-500 text-white shadow-sm'
                            : 'bg-gray-100 text-gray-700 border border-gray-300 hover:border-navy-400 hover:text-navy-600'
                        }
                      `}
                    >
                      <span>{childCategory.name}</span>

                      {/* Product count badge */}
                      {childCategory.productCount !== undefined && childCategory.productCount > 0 && (
                        <span className={`text-xs px-1.5 py-0.5 rounded ${
                          isSelected
                            ? 'bg-navy-400 text-white'
                            : 'bg-gray-200 text-gray-600'
                        }`}>
                          {childCategory.productCount}
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Filtered Products Section - Show when categories are selected */}
      {selectedCategoryIds.size > 0 && filteredProducts.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">{t('filteredProducts')}</h2>
              <p className="text-sm text-gray-600 mt-1">
                {filteredProducts.length} product{filteredProducts.length !== 1 ? 's' : ''} found
              </p>
            </div>
            <Link href={`/${locale}/shop`} className="text-sm font-medium text-navy-600 hover:text-navy-700">
              {t('viewAll')}
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {filteredProducts.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </section>
      )}

      {/* Recently Viewed - Only for authenticated users and if has filtered products */}
      {isAuthenticated && filteredRecentlyViewed.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">{t('recentlyViewed')}</h2>
              <p className="text-sm text-gray-600 mt-1">{t('recentlyViewedSubtitle')}</p>
            </div>
            <Link href={`/${locale}/shop`} className="text-sm font-medium text-navy-600 hover:text-navy-700">
              {t('viewAll')}
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {filteredRecentlyViewed.slice(0, 4).map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </section>
      )}

      {/* Personalized Recommendations - Only for authenticated users and if has filtered products */}
      {isAuthenticated && filteredRecommendations.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">{t('recommendedForYou')}</h2>
              <p className="text-sm text-gray-600 mt-1">{t('recommendedSubtitle')}</p>
            </div>
            <Link href={`/${locale}/shop`} className="text-sm font-medium text-navy-600 hover:text-navy-700">
              {t('viewAll')}
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {filteredRecommendations.slice(0, 8).map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </section>
      )}

      {/* Promotional Categories Sections - Filtered */}
      {filteredPromotionalCategories.map(({ category, products }) => (
        <section key={category.id} className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">{category.name}</h2>
              {category.description && (
                <p className="text-sm text-gray-600 mt-1">{category.description}</p>
              )}
            </div>
            <Link
              href={`/${locale}/shop?promo=${category.slug}`}
              className="text-sm font-medium text-navy-600 hover:text-navy-700"
            >
              {t('viewAll')}
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {products.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </section>
      ))}

      {/* New Arrivals - Only if has filtered products */}
      {filteredNewArrivals.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">{t('newArrivals')}</h2>
              <p className="text-sm text-gray-600 mt-1">{t('newArrivalsSubtitle')}</p>
            </div>
            <Link href={`/${locale}/shop`} className="text-sm font-medium text-navy-600 hover:text-navy-700">
              {t('viewAll')}
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {filteredNewArrivals.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </section>
      )}

      {/* Call to Action */}
      {!isAuthenticated && (
        <section className="relative bg-gradient-to-r from-navy-900 via-navy-800 to-navy-900 text-white py-20 sm:py-24 overflow-hidden">
          {/* Background Pattern */}
          <div className="absolute inset-0 opacity-10">
            <div className="absolute top-0 left-1/4 w-96 h-96 bg-gold-500 rounded-full mix-blend-multiply filter blur-3xl"></div>
            <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-coral-500 rounded-full mix-blend-multiply filter blur-3xl"></div>
          </div>

          <div className="relative mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 text-center">
            {/* Icon */}
            <div className="inline-flex items-center justify-center w-16 h-16 bg-gold-500/20 rounded-full mb-6">
              <svg className="w-8 h-8 text-gold-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
              </svg>
            </div>

            <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-6 leading-tight tracking-tight">
              {t('cta.title')}
            </h2>
            <p className="text-lg sm:text-xl text-gray-200 mb-10 max-w-2xl mx-auto leading-relaxed">
              {t('cta.subtitle')}
            </p>

            {/* CTA Button - Following Style Guide */}
            <Link
              href={`/${locale}/signup`}
              className="inline-flex items-center gap-2 btn-primary text-lg px-8 py-4 shadow-2xl hover:shadow-coral-500/50"
            >
              {t('cta.createAccount')}
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </Link>

            {/* Features Grid */}
            <div className="mt-16 grid grid-cols-1 sm:grid-cols-3 gap-8">
              <div className="text-center">
                <div className="text-3xl font-bold text-gold-400 mb-2">{t('stats.savingsValue')}</div>
                <div className="text-sm text-gray-300">{t('stats.savingsLabel')}</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-gold-400 mb-2">{t('stats.productsValue')}</div>
                <div className="text-sm text-gray-300">{t('stats.productsLabel')}</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-gold-400 mb-2">{t('stats.supportValue')}</div>
                <div className="text-sm text-gray-300">{t('stats.supportLabel')}</div>
              </div>
            </div>
          </div>
        </section>
      )}
    </main>
  )
}
