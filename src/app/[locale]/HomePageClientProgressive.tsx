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
  getCategoryTreeAction,
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
          <div className="absolute top-2 right-2 bg-black-800 text-white px-2 py-1 rounded-full text-xs font-bold">
            {discountPercent}% OFF
          </div>
        )}
      </div>
      <div className="p-2 sm:p-3 md:p-4">
        <h3 className="font-semibold text-gray-900 md:line-clamp-2 text-xs sm:text-sm md:text-base break-words">{product.name}</h3>
        <p className="text-xs sm:text-sm text-gray-600 mt-1">{product.brand}</p>
        <div className="mt-2 flex flex-col sm:flex-row sm:items-baseline gap-0 sm:gap-1 min-w-0">
          <span className="text-sm sm:text-base md:text-lg font-bold text-black-900 truncate">Rs {product.stockPrice.toFixed(0)}</span>
          <span className="text-[10px] sm:text-xs md:text-sm text-gray-500 line-through truncate">Rs {product.retailPrice.toFixed(0)}</span>
        </div>
        <p className="text-xs text-gray-500 mt-1">
          {totalStock > 0 ? `${totalStock} ${t('inStock')}` : t('outOfStock')}
        </p>
      </div>
    </Link>
  )
}

export default function HomePageClientProgressive({
  isAuthenticated,
  recommendations,
  recentlyViewed,
  newArrivals,
  promotionalCategories,
}: HomePageClientProps) {
  const locale = useLocale()
  const router = useRouter()
  const t = useTranslations('home')

  // State
  const [allCategories, setAllCategories] = useState<Category[]>([])
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set())
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<Set<string>>(new Set())
  const [filteredProducts, setFilteredProducts] = useState<ProductWithVariants[]>([])
  const [loading, setLoading] = useState(false)

  // Load all categories on mount
  useEffect(() => {
    loadCategories()
  }, [])

  // Fetch products when selections change
  useEffect(() => {
    if (selectedCategoryIds.size > 0) {
      fetchFilteredProducts()
    } else {
      setFilteredProducts([])
    }
  }, [selectedCategoryIds])

  async function loadCategories() {
    const result = await getCategoryTreeAction()
    if (result.success && result.data) {
      // Recursively flatten the tree structure into a single array
      const flattenCategory = (cat: any): Category[] => {
        const { children, ...categoryData } = cat
        const flattened: Category[] = [categoryData]
        if (children && children.length > 0) {
          children.forEach((child: any) => {
            flattened.push(...flattenCategory(child))
          })
        }
        return flattened
      }

      const allCats: Category[] = []
      if (result.data.ladies) {
        result.data.ladies.forEach((cat: any) => {
          allCats.push(...flattenCategory(cat))
        })
      }
      if (result.data.gents) {
        result.data.gents.forEach((cat: any) => {
          allCats.push(...flattenCategory(cat))
        })
      }
      if (result.data.kids) {
        result.data.kids.forEach((cat: any) => {
          allCats.push(...flattenCategory(cat))
        })
      }
      setAllCategories(allCats)
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

  function toggleCategoryExpansion(categoryId: string) {
    const newExpanded = new Set(expandedCategories)
    if (newExpanded.has(categoryId)) {
      newExpanded.delete(categoryId)
    } else {
      newExpanded.add(categoryId)
    }
    setExpandedCategories(newExpanded)
  }

  function toggleCategorySelection(categoryId: string) {
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
    setExpandedCategories(new Set())
    setFilteredProducts([])
  }

  // Get top-level categories (L0)
  const topLevelCategories = allCategories.filter(c => c.level === 0)

  // Get children for a specific parent
  const getChildren = (parentId: string) => {
    return allCategories.filter(c => c.parentId === parentId)
  }

  // Get hierarchy color
  const getHierarchyColor = (hierarchy: string, selected: boolean) => {
    if (selected) {
      switch (hierarchy) {
        case 'ladies': return 'bg-black-700 text-white'
        case 'gents': return 'bg-black-700 text-white'
        case 'kids': return 'bg-green-600 text-white'
        default: return 'bg-black-700 text-white'
      }
    } else {
      switch (hierarchy) {
        case 'ladies': return 'bg-pink-100 text-pink-800 hover:bg-gray-200'
        case 'gents': return 'bg-gray-100 text-black-800 hover:bg-blue-200'
        case 'kids': return 'bg-green-100 text-green-800 hover:bg-green-200'
        default: return 'bg-gray-100 text-gray-800 hover:bg-gray-200'
      }
    }
  }

  // Get category chip size based on level
  const getCategoryChipStyle = (level: number) => {
    switch (level) {
      case 0: return 'px-5 py-3 text-lg font-bold'
      case 1: return 'px-4 py-2 text-base font-semibold'
      case 2: return 'px-3 py-1.5 text-sm font-medium'
      default: return 'px-2 py-1 text-xs font-medium'
    }
  }

  // Render category and its children recursively
  const renderCategory = (category: Category) => {
    const isExpanded = expandedCategories.has(category.id)
    const isSelected = selectedCategoryIds.has(category.id)
    const children = getChildren(category.id)
    const hasChildren = children.length > 0

    return (
      <div key={category.id} className="mb-2">
        <div className="flex items-center gap-2">
          {/* Expand/Collapse button */}
          {hasChildren && (
            <button
              onClick={() => toggleCategoryExpansion(category.id)}
              className="w-6 h-6 flex items-center justify-center text-gray-600 hover:text-gray-900 transition-colors"
              aria-label={isExpanded ? 'Collapse' : 'Expand'}
            >
              {isExpanded ? '▼' : '▶'}
            </button>
          )}
          {!hasChildren && <div className="w-6" />}

          {/* Category chip */}
          <button
            onClick={() => toggleCategorySelection(category.id)}
            className={`${getCategoryChipStyle(category.level)} rounded-full transition-all ${getHierarchyColor(category.hierarchy, isSelected)}`}
          >
            {category.name}
            {category.productCount !== undefined && category.productCount > 0 && (
              <span className="ml-2 text-xs opacity-75">({category.productCount})</span>
            )}
          </button>
        </div>

        {/* Render children if expanded */}
        {isExpanded && hasChildren && (
          <div className="ml-8 mt-2 space-y-2">
            {children.map(child => renderCategory(child))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero Section */}
      <div className="relative bg-black-900 text-white overflow-hidden">
        {/* Decorative background elements */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 left-0 w-96 h-96 bg-black-700 rounded-full filter blur-3xl transform -translate-x-1/2 -translate-y-1/2"></div>
          <div className="absolute bottom-0 right-0 w-96 h-96 bg-gray-400 rounded-full filter blur-3xl transform translate-x-1/2 translate-y-1/2"></div>
        </div>

        <div className="relative container mx-auto px-4 py-16 md:py-24">
          <div className="max-w-4xl mx-auto text-center">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/10 backdrop-blur-sm rounded-full mb-6 border border-white/20">
              <svg className="w-5 h-5 text-gray-300" fill="currentColor" viewBox="0 0 20 20">
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
              <span className="text-sm font-semibold">Premium Brands at Wholesale Prices</span>
            </div>

            {/* Main Heading */}
            <h1 className="text-5xl md:text-7xl font-bold mb-6 leading-tight">
              Welcome to{' '}
              <span className="bg-gray-600 bg-clip-text text-transparent">
                Ecom
              </span>
            </h1>

            {/* Subtitle */}
            <p className="text-xl md:text-2xl text-gray-200 mb-10 max-w-2xl mx-auto">
              Discover authentic branded clothing at unbeatable stock prices.
              Quality fashion shouldn&apos;t break the bank.
            </p>

            {/* Search Bar */}
            <div className="max-w-2xl mx-auto mb-8">
              <SearchAutocomplete />
            </div>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <Link
                href={`/${locale}/shop`}
                className="px-8 py-4 bg-black-800 hover:bg-black-700 text-white font-semibold rounded-lg shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 transition-all duration-200 w-full sm:w-auto text-center"
              >
                Browse All Products
              </Link>
              {!isAuthenticated && (
                <Link
                  href={`/${locale}/signup`}
                  className="px-8 py-4 bg-white/10 hover:bg-white/20 backdrop-blur-sm text-white font-semibold rounded-lg border border-white/30 hover:border-white/50 transform hover:-translate-y-0.5 transition-all duration-200 w-full sm:w-auto text-center"
                >
                  Sign Up for Deals
                </Link>
              )}
            </div>

           
            
          </div>
        </div>
      </div>

      {/* Category Filter Section */}
      {topLevelCategories.length > 0 && (
        <div className="sticky top-0 z-10 bg-white shadow-md py-4">
          <div className="container mx-auto px-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-semibold">Shop by Category</h2>
              {selectedCategoryIds.size > 0 && (
                <button
                  onClick={clearFilters}
                  className="text-sm text-black-800 hover:text-coral-700 font-medium"
                >
                  Clear All ({selectedCategoryIds.size})
                </button>
              )}
            </div>

            {/* Progressive Category Display - Horizontal Chips */}
            <div className="space-y-4">
              {/* Level 0: Top-level categories (Ladies, Gents, Kids) */}
              <div className="flex flex-wrap gap-2">
                {topLevelCategories.map(category => (
                  <button
                    key={category.id}
                    onClick={() => toggleCategoryExpansion(category.id)}
                    className={`px-6 py-2 rounded-full font-medium transition-all ${
                      getHierarchyColor(category.hierarchy, expandedCategories.has(category.id))
                    }`}
                  >
                    {category.name}
                  </button>
                ))}
              </div>

              {/* Level 1+: Show children of expanded categories */}
              {Array.from(expandedCategories).map(expandedId => {
                const expandedCategory = allCategories.find(c => c.id === expandedId)
                if (!expandedCategory) return null

                const renderLevel = (parentId: string, depth: number = 1) => {
                  const children = getChildren(parentId)
                  if (children.length === 0) return null

                  const parentCategory = allCategories.find(c => c.id === parentId)
                  if (!parentCategory) return null

                  return (
                    <div key={`level-${parentId}`} className="space-y-3 pl-4 border-l-2 border-gray-200">
                      {/* Show children as horizontal chips */}
                      <div className="flex flex-wrap gap-2">
                        {children.map(child => (
                          <button
                            key={child.id}
                            onClick={() => toggleCategorySelection(child.id)}
                            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${
                              getHierarchyColor(child.hierarchy, selectedCategoryIds.has(child.id))
                            }`}
                          >
                            {child.name} ({child.productCount || 0})
                          </button>
                        ))}
                      </div>

                      {/* Recursively render children of selected subcategories */}
                      {children.map(child => {
                        if (selectedCategoryIds.has(child.id) && getChildren(child.id).length > 0) {
                          return renderLevel(child.id, depth + 1)
                        }
                        return null
                      })}
                    </div>
                  )
                }

                return renderLevel(expandedId)
              })}
            </div>
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
                  className="text-black-700 hover:text-black-950 font-medium"
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
              {recentlyViewed.map(product => (
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
              {recommendations.map(product => (
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
                className="text-black-700 hover:text-black-950 font-medium"
              >
                View All →
              </Link>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {newArrivals.slice(0, 10).map(product => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          </section>
        )}

        {/* CTA Section */}
        <section className="bg-black-800 text-white rounded-lg p-8 text-center">
          <h2 className="text-3xl font-bold mb-4">Start Exploring</h2>
          <p className="text-lg mb-6">Discover thousands of branded items at unbeatable prices</p>
          <Link
            href={`/${locale}/shop`}
            className="inline-block bg-black-800 hover:bg-coral-700 text-white font-bold px-8 py-3 rounded-lg transition-colors"
          >
            Browse All Products
          </Link>
        </section>
      </div>
    </div>
  )
}
