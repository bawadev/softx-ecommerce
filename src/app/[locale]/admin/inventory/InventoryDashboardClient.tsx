'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useLocale } from 'next-intl'
import type { ProductWithVariants } from '@/lib/repositories/product.repository'

interface InventoryDashboardClientProps {
  products: ProductWithVariants[]
}

type SortOption = 'stock-asc' | 'stock-desc' | 'name'
type FilterOption = 'all' | 'low' | 'medium' | 'good' | 'out'

export default function InventoryDashboardClient({ products }: InventoryDashboardClientProps) {
  const locale = useLocale()
  const [sortBy, setSortBy] = useState<SortOption>('stock-asc')
  const [filterBy, setFilterBy] = useState<FilterOption>('all')

  // Calculate stock levels and stats
  const productsWithStock = useMemo(() => {
    return products.map(product => {
      const totalStock = product.variants.reduce((sum, v) => sum + v.stockQuantity, 0)
      let stockLevel: 'out' | 'low' | 'medium' | 'good'

      if (totalStock === 0) stockLevel = 'out'
      else if (totalStock < 10) stockLevel = 'low'
      else if (totalStock < 30) stockLevel = 'medium'
      else stockLevel = 'good'

      return { ...product, totalStock, stockLevel }
    })
  }, [products])

  // Apply filters and sorting
  const filteredAndSortedProducts = useMemo(() => {
    let filtered = productsWithStock

    // Apply stock level filter
    if (filterBy !== 'all') {
      filtered = filtered.filter(p => p.stockLevel === filterBy)
    }

    // Apply sorting
    const sorted = [...filtered].sort((a, b) => {
      switch (sortBy) {
        case 'stock-asc':
          return a.totalStock - b.totalStock
        case 'stock-desc':
          return b.totalStock - a.totalStock
        case 'name':
          return a.name.localeCompare(b.name)
        default:
          return 0
      }
    })

    return sorted
  }, [productsWithStock, sortBy, filterBy])

  // Calculate statistics
  const stats = useMemo(() => {
    const totalProducts = productsWithStock.length
    const totalUnits = productsWithStock.reduce((sum, p) => sum + p.totalStock, 0)
    const outOfStock = productsWithStock.filter(p => p.stockLevel === 'out').length
    const lowStock = productsWithStock.filter(p => p.stockLevel === 'low').length
    const mediumStock = productsWithStock.filter(p => p.stockLevel === 'medium').length
    const goodStock = productsWithStock.filter(p => p.stockLevel === 'good').length

    return { totalProducts, totalUnits, outOfStock, lowStock, mediumStock, goodStock }
  }, [productsWithStock])

  const getStockLevelColor = (level: 'out' | 'low' | 'medium' | 'good') => {
    switch (level) {
      case 'out':
        return 'bg-red-100 text-red-800 border-red-200'
      case 'low':
        return 'bg-orange-100 text-orange-800 border-orange-200'
      case 'medium':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      case 'good':
        return 'bg-green-100 text-green-800 border-green-200'
    }
  }

  const getStockLevelBadge = (level: 'out' | 'low' | 'medium' | 'good') => {
    switch (level) {
      case 'out':
        return 'OUT OF STOCK'
      case 'low':
        return 'LOW STOCK'
      case 'medium':
        return 'MEDIUM STOCK'
      case 'good':
        return 'GOOD STOCK'
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-navy-900">Inventory Dashboard</h1>
              <p className="mt-1 text-sm text-gray-600">Monitor stock levels and manage inventory</p>
            </div>
            <Link href={`/${locale}/admin/dashboard`} className="text-sm text-navy-600 hover:text-navy-700 font-medium">
              ← Back to Dashboard
            </Link>
          </div>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          <div className="bg-white p-3 sm:p-4 rounded-lg shadow-sm border border-gray-200">
            <p className="text-xs sm:text-sm font-medium text-gray-600">Total Products</p>
            <p className="mt-1 sm:mt-2 text-2xl sm:text-3xl font-bold text-gray-900">{stats.totalProducts}</p>
          </div>
          <div className="bg-white p-3 sm:p-4 rounded-lg shadow-sm border border-gray-200">
            <p className="text-xs sm:text-sm font-medium text-gray-600">Total Units</p>
            <p className="mt-1 sm:mt-2 text-2xl sm:text-3xl font-bold text-gray-900">{stats.totalUnits}</p>
          </div>
          <div className="bg-white p-3 sm:p-4 rounded-lg shadow-sm border border-orange-200">
            <p className="text-xs sm:text-sm font-medium text-orange-600">Low Stock</p>
            <p className="mt-1 sm:mt-2 text-2xl sm:text-3xl font-bold text-orange-600">{stats.lowStock}</p>
          </div>
          <div className="bg-white p-3 sm:p-4 rounded-lg shadow-sm border border-red-200">
            <p className="text-xs sm:text-sm font-medium text-red-600">Out of Stock</p>
            <p className="mt-1 sm:mt-2 text-2xl sm:text-3xl font-bold text-red-600">{stats.outOfStock}</p>
          </div>
        </div>

        {/* Stock Level Summary */}
        <div className="mt-6 bg-white p-4 rounded-lg shadow-sm border border-gray-200">
          <h2 className="text-sm font-semibold text-gray-900 mb-3">Stock Level Distribution</h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-red-500"></div>
              <span className="text-sm text-gray-700">Out of Stock: {stats.outOfStock}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-orange-500"></div>
              <span className="text-sm text-gray-700">Low (&lt;10): {stats.lowStock}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
              <span className="text-sm text-gray-700">Medium (10-30): {stats.mediumStock}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-green-500"></div>
              <span className="text-sm text-gray-700">Good (&gt;30): {stats.goodStock}</span>
            </div>
          </div>
        </div>

        {/* Filters and Sorting */}
        <div className="mt-6 bg-white p-4 rounded-lg shadow-sm border border-gray-200">
          <div className="flex flex-wrap gap-4 items-end">
            <div className="flex-1 min-w-[200px]">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Filter by Stock Level
              </label>
              <select
                value={filterBy}
                onChange={(e) => setFilterBy(e.target.value as FilterOption)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-navy-600 focus:border-transparent"
              >
                <option value="all">All Items</option>
                <option value="out">Out of Stock</option>
                <option value="low">Low Stock</option>
                <option value="medium">Medium Stock</option>
                <option value="good">Good Stock</option>
              </select>
            </div>

            <div className="flex-1 min-w-[200px]">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Sort By
              </label>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortOption)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-navy-600 focus:border-transparent"
              >
                <option value="stock-asc">Stock (Low to High)</option>
                <option value="stock-desc">Stock (High to Low)</option>
                <option value="name">Name (A-Z)</option>
                <option value="category">Category</option>
              </select>
            </div>
          </div>
        </div>

        {/* Inventory List */}
        <div className="mt-6 space-y-3">
          {filteredAndSortedProducts.map((product) => {
            const firstImage = product.images?.[0]

            return (
              <div
                key={product.id}
                className={`bg-white rounded-lg shadow-sm border-2 overflow-hidden ${getStockLevelColor(product.stockLevel)}`}
              >
                {/* Mobile layout */}
                <div className="sm:hidden p-3">
                  <div className="flex gap-3 items-start">
                    {/* Thumbnail */}
                    <div className="relative h-16 w-16 flex-shrink-0 overflow-hidden rounded-lg bg-gray-100">
                      {firstImage ? (
                        <Image
                          src={firstImage}
                          alt={product.name}
                          fill
                          className="object-cover"
                          sizes="64px"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center text-gray-400 text-xs">
                          No Img
                        </div>
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="text-sm font-semibold text-gray-900 truncate">{product.name}</h3>
                        <span className={`flex-shrink-0 inline-block px-2 py-0.5 text-[10px] font-bold rounded-full ${
                          product.stockLevel === 'out' ? 'bg-red-600 text-white' :
                          product.stockLevel === 'low' ? 'bg-orange-600 text-white' :
                          product.stockLevel === 'medium' ? 'bg-yellow-600 text-white' :
                          'bg-green-600 text-white'
                        }`}>
                          {getStockLevelBadge(product.stockLevel)}
                        </span>
                      </div>
                      <p className="text-xs text-gray-600">{product.brand} &middot; {product.category}</p>
                      <p className="text-xs text-gray-400">SKU: {product.sku}</p>
                    </div>
                  </div>

                  {/* Variants */}
                  <div className="mt-2 grid grid-cols-2 gap-1.5">
                    {product.variants.map((variant) => (
                      <div
                        key={variant.id}
                        className="flex items-center justify-between bg-white bg-opacity-50 px-2 py-1.5 rounded border border-gray-200 text-xs"
                      >
                        <span>
                          <span className="font-medium">{variant.size}</span>
                          <span className="text-gray-500"> &middot; {variant.color}</span>
                        </span>
                        <span className={`font-semibold ml-1 ${
                          variant.stockQuantity === 0 ? 'text-red-600' :
                          variant.stockQuantity < 5 ? 'text-orange-600' :
                          variant.stockQuantity < 15 ? 'text-yellow-600' :
                          'text-green-600'
                        }`}>
                          {variant.stockQuantity}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Footer */}
                  <div className="mt-2 pt-2 border-t border-gray-100 flex items-center justify-between">
                    <div className="text-xs">
                      <span className="font-medium text-gray-900">Total: </span>
                      <span className={`font-bold ${
                        product.totalStock === 0 ? 'text-red-600' :
                        product.totalStock < 10 ? 'text-orange-600' :
                        product.totalStock < 30 ? 'text-yellow-600' :
                        'text-green-600'
                      }`}>
                        {product.totalStock} units
                      </span>
                    </div>
                    <Link
                      href={`/${locale}/admin/products`}
                      className="text-xs font-medium text-navy-600 hover:text-navy-700"
                    >
                      Manage →
                    </Link>
                  </div>
                </div>

                {/* Desktop layout */}
                <div className="hidden sm:block p-4">
                  <div className="flex items-center gap-4">
                    {/* Product Image */}
                    <div className="relative h-20 w-20 flex-shrink-0 overflow-hidden rounded-lg bg-gray-100">
                      {firstImage ? (
                        <Image
                          src={firstImage}
                          alt={product.name}
                          fill
                          className="object-cover"
                          sizes="80px"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center text-gray-400 text-xs">
                          No Image
                        </div>
                      )}
                    </div>

                    {/* Product Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <h3 className="text-lg font-semibold text-gray-900 truncate">{product.name}</h3>
                          <p className="text-sm text-gray-600">{product.brand} &middot; {product.category}</p>
                          <p className="text-xs text-gray-500 mt-1">SKU: {product.sku}</p>
                        </div>

                        {/* Stock Level Badge */}
                        <div className="flex-shrink-0">
                          <span className={`inline-block px-3 py-1 text-xs font-bold rounded-full ${
                            product.stockLevel === 'out' ? 'bg-red-600 text-white' :
                            product.stockLevel === 'low' ? 'bg-orange-600 text-white' :
                            product.stockLevel === 'medium' ? 'bg-yellow-600 text-white' :
                            'bg-green-600 text-white'
                          }`}>
                            {getStockLevelBadge(product.stockLevel)}
                          </span>
                        </div>
                      </div>

                      {/* Variants Breakdown */}
                      <div className="mt-3 grid grid-cols-2 lg:grid-cols-3 gap-2">
                        {product.variants.map((variant) => (
                          <div
                            key={variant.id}
                            className="flex items-center justify-between bg-white bg-opacity-50 px-3 py-2 rounded border border-gray-200"
                          >
                            <div className="text-sm">
                              <span className="font-medium">{variant.size}</span>
                              <span className="text-gray-600"> &middot; {variant.color}</span>
                            </div>
                            <div className={`text-sm font-semibold ${
                              variant.stockQuantity === 0 ? 'text-red-600' :
                              variant.stockQuantity < 5 ? 'text-orange-600' :
                              variant.stockQuantity < 15 ? 'text-yellow-600' :
                              'text-green-600'
                            }`}>
                              {variant.stockQuantity} units
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Total and Actions */}
                      <div className="mt-3 flex items-center justify-between">
                        <div className="text-sm">
                          <span className="font-medium text-gray-900">Total Stock: </span>
                          <span className={`font-bold ${
                            product.totalStock === 0 ? 'text-red-600' :
                            product.totalStock < 10 ? 'text-orange-600' :
                            product.totalStock < 30 ? 'text-yellow-600' :
                            'text-green-600'
                          }`}>
                            {product.totalStock} units
                          </span>
                        </div>
                        <Link
                          href={`/${locale}/admin/products`}
                          className="text-sm font-medium text-navy-600 hover:text-navy-700"
                        >
                          Manage Products →
                        </Link>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* Empty State */}
        {filteredAndSortedProducts.length === 0 && (
          <div className="mt-6 bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
            <p className="text-gray-500">No products match the selected filters.</p>
          </div>
        )}

        {/* Summary */}
        {filteredAndSortedProducts.length > 0 && (
          <div className="mt-6 text-sm text-gray-600">
            <p>Showing {filteredAndSortedProducts.length} of {stats.totalProducts} products</p>
          </div>
        )}
      </div>
    </div>
  )
}
