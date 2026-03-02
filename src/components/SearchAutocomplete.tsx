'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useLocale } from 'next-intl'
import { searchProductsAction } from '@/app/actions/products'
import { ProductWithVariants } from '@/lib/repositories/product.repository'
import Image from 'next/image'

interface SearchAutocompleteProps {
  onSearch?: (query: string) => void
  placeholder?: string
  className?: string
  large?: boolean
}

export default function SearchAutocomplete({
  onSearch,
  placeholder = 'Search for products...',
  className = '',
  large = false,
}: SearchAutocompleteProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<ProductWithVariants[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()
  const locale = useLocale()
  const wrapperRef = useRef<HTMLDivElement>(null)

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Debounced search
  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([])
      setIsOpen(false)
      return
    }

    setIsLoading(true)
    const timeoutId = setTimeout(async () => {
      const response = await searchProductsAction(query)
      if (response.success && response.products) {
        setResults(response.products.slice(0, 6)) // Limit to 6 suggestions
        setIsOpen(true)
      }
      setIsLoading(false)
    }, 300)

    return () => clearTimeout(timeoutId)
  }, [query])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (query.trim()) {
      setIsOpen(false)
      if (onSearch) {
        onSearch(query)
      } else {
        router.push(`/${locale}/shop?search=${encodeURIComponent(query)}`)
      }
    }
  }

  const handleProductClick = (productId: string) => {
    setIsOpen(false)
    setQuery('')
    router.push(`/${locale}/product/${productId}`)
  }

  const inputClasses = large
    ? 'w-full px-4 sm:px-5 md:px-6 py-2.5 sm:py-3 md:py-4 text-sm sm:text-base md:text-lg rounded-full border-2 border-gray-200 focus:border-gray-500 focus:outline-none focus:ring-2 focus:ring-navy-200 transition-all bg-white text-gray-900'
    : 'w-full px-3 sm:px-4 py-2 text-sm sm:text-base rounded-lg border border-gray-300 focus:border-gray-500 focus:outline-none focus:ring-2 focus:ring-navy-200 transition-all bg-white text-gray-900'

  return (
    <div ref={wrapperRef} className={`relative`}>
      <form onSubmit={handleSearch}>
        <div className="relative">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={placeholder}
            className={`${inputClasses} ${className}`}
          />
          <button
            type="submit"
            className={`absolute right-1 sm:right-2 ${
              large ? 'top-1 sm:top-1.5 md:top-2' : 'top-1/2 -translate-y-1/2'
            } bg-black-800 text-white ${
              large ? 'px-4 sm:px-6 md:px-8 py-2 sm:py-2.5 md:py-3 text-sm sm:text-base rounded-full' : 'px-3 sm:px-4 py-1.5 sm:py-2 text-sm sm:text-base rounded-lg'
            } hover:bg-coral-700 transition-colors font-semibold`}
          >
            <span className="hidden sm:inline">Search</span>
            <span className="sm:hidden">Go</span>
          </button>
        </div>
      </form>

      {/* Autocomplete Dropdown */}
      {isOpen && results.length > 0 && (
        <div className="absolute z-50 w-full mt-2 bg-white rounded-lg shadow-xl border border-gray-200 max-h-96 overflow-y-auto">
          {isLoading && (
            <div className="p-4 text-center text-gray-500">
              <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-black-700"></div>
            </div>
          )}

          {!isLoading && results.map((product) => {
            const firstImage = product.variants.find((v) => v.images?.length > 0)?.images?.[0]
            const discountPercent = Math.round(
              ((product.retailPrice - product.stockPrice) / product.retailPrice) * 100
            )

            return (
              <button
                key={product.id}
                onClick={() => handleProductClick(product.id)}
                className="w-full flex items-center gap-4 p-3 hover:bg-gray-50 transition-colors border-b border-gray-100 last:border-b-0 text-left"
              >
                <div className="relative w-16 h-16 bg-gray-100 rounded-md flex-shrink-0 overflow-hidden">
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
                      No image
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-semibold text-gray-900 truncate">{product.name}</h4>
                  <p className="text-sm text-gray-600">{product.brand}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="font-bold text-black-900">Rs {product.stockPrice.toFixed(2)}</span>
                    <span className="text-xs text-gray-500 line-through">
                      Rs {product.retailPrice.toFixed(2)}
                    </span>
                    {discountPercent > 0 && (
                      <span className="text-xs bg-coral-100 text-coral-700 px-2 py-0.5 rounded-full font-semibold">
                        {discountPercent}% OFF
                      </span>
                    )}
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      )}

      {isOpen && !isLoading && query.trim().length >= 2 && results.length === 0 && (
        <div className="absolute z-50 w-full mt-2 bg-white rounded-lg shadow-xl border border-gray-200 p-4 text-center text-gray-500">
          No products found for &quot;{query}&quot;
        </div>
      )}
    </div>
  )
}
