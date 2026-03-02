'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'
import type { ProductWithVariants } from '@/lib/repositories/product.repository'
import { getColorHex } from '@/lib/color-utils'
import { addToCartAction } from '@/app/actions/cart'

interface ProductCardProps {
  product: ProductWithVariants
}

export default function ProductCard({ product }: ProductCardProps) {
  const locale = useLocale()
  const t = useTranslations('product')
  const router = useRouter()
  const cardRef = useRef<HTMLDivElement>(null)

  // Unique sizes and colors
  const sizes = Array.from(new Set(product.variants.map((v) => v.size)))
  const colors = Array.from(new Set(product.variants.map((v) => v.color)))

  // State
  const [selectedSize, setSelectedSize] = useState<string | null>(null)
  const [selectedColor, setSelectedColor] = useState<string | null>(null)
  const [isAdding, setIsAdding] = useState(false)
  const [isQuickBuying, setIsQuickBuying] = useState(false)
  const [showMobilePanel, setShowMobilePanel] = useState(false)
  const [needsSelection, setNeedsSelection] = useState<'size' | 'color' | null>(null)
  const [isTouchDevice, setIsTouchDevice] = useState(false)

  // Get first variant for display image and check stock
  const firstVariant = product.variants[0]
  const hasStock = product.variants.some((v) => v.stockQuantity > 0)
  const totalStock = product.variants.reduce((sum, v) => sum + v.stockQuantity, 0)

  // Calculate discount percentage
  const discountPercent = Math.round(
    ((product.retailPrice - product.stockPrice) / product.retailPrice) * 100
  )

  const productUrl = `/${locale}/product/${product.id}`

  // Auto-select if only 1 size or 1 color
  useEffect(() => {
    if (sizes.length === 1) setSelectedSize(sizes[0])
    if (colors.length === 1) setSelectedColor(colors[0])
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Detect touch device
  useEffect(() => {
    setIsTouchDevice(window.matchMedia('(hover: none)').matches)
  }, [])

  // Close mobile panel on outside click
  useEffect(() => {
    if (!showMobilePanel) return
    function handleOutsideClick(e: MouseEvent) {
      if (cardRef.current && !cardRef.current.contains(e.target as Node)) {
        setShowMobilePanel(false)
      }
    }
    document.addEventListener('click', handleOutsideClick)
    return () => document.removeEventListener('click', handleOutsideClick)
  }, [showMobilePanel])

  // Clear needsSelection flash after 1.5s
  useEffect(() => {
    if (!needsSelection) return
    const timer = setTimeout(() => setNeedsSelection(null), 1500)
    return () => clearTimeout(timer)
  }, [needsSelection])

  // Variant resolution
  const selectedVariant =
    selectedSize && selectedColor
      ? product.variants.find((v) => v.size === selectedSize && v.color === selectedColor)
      : null

  const isVariantAvailable = selectedVariant ? selectedVariant.stockQuantity > 0 : false

  // Handle card click for mobile tap-to-toggle
  const handleCardClick = useCallback(
    (e: React.MouseEvent) => {
      if (!isTouchDevice || !hasStock) return
      if (!showMobilePanel) {
        e.preventDefault()
        setShowMobilePanel(true)
      }
    },
    [isTouchDevice, showMobilePanel, hasStock]
  )

  // Validate selection before action
  const validateSelection = (): boolean => {
    if (!selectedSize) {
      setNeedsSelection('size')
      return false
    }
    if (!selectedColor) {
      setNeedsSelection('color')
      return false
    }
    return true
  }

  // Add to cart handler
  const handleAddToCart = async (e: React.MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()
    if (!validateSelection() || !selectedVariant || !isVariantAvailable) return

    setIsAdding(true)
    try {
      await addToCartAction(selectedVariant.id, 1)
    } finally {
      setIsAdding(false)
    }
  }

  // Quick buy handler
  const handleQuickBuy = async (e: React.MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()
    if (!validateSelection() || !selectedVariant || !isVariantAvailable) return

    setIsQuickBuying(true)
    try {
      await addToCartAction(selectedVariant.id, 1)
      router.push(`/${locale}/checkout`)
    } finally {
      setIsQuickBuying(false)
    }
  }

  return (
    <div ref={cardRef} className="card-hover group relative overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
      {/* Image - clickable link */}
      <Link href={productUrl} onClick={handleCardClick} className="relative z-0 block">
        <div className="relative aspect-[3/4] overflow-hidden rounded-t-lg bg-gray-100">
          {(firstVariant?.images?.[0] || product.images?.[0]) ? (
            <Image
              src={firstVariant?.images?.[0] || product.images[0]}
              alt={product.name}
              fill
              className="object-cover transition-transform duration-500 group-hover:scale-110"
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-gray-400">
              {t('noImage')}
            </div>
          )}

          {/* Discount Badge */}
          {discountPercent > 0 && (
            <div className="absolute right-3 top-3 rounded-full bg-white px-3 py-1 text-xs font-bold text-black-900 shadow-lg z-10">
              -{discountPercent}%
            </div>
          )}

          {/* Stock Status */}
          {!hasStock && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-900/70 z-10">
              <span className="rounded-lg bg-gray-800 px-4 py-2 text-sm font-semibold text-white">
                Out of Stock
              </span>
            </div>
          )}

          {hasStock && totalStock < 10 && (
            <div className="absolute left-3 top-3 rounded-full bg-amber-500 px-3 py-1 text-xs font-bold text-white shadow-lg z-10">
              Low Stock
            </div>
          )}
        </div>
      </Link>

      {/* Enhanced floating overlay panel */}
      <div className="absolute bottom-0 left-0 right-0 z-20 bg-white">
        {/* Title and Price - always visible */}
        <div className="p-2 sm:p-3 border-t border-gray-100 rounded-b-lg">
          <Link
            href={productUrl}
            onClick={handleCardClick}
            className="block"
          >
            <h3 className="line-clamp-2 font-semibold text-gray-900 text-xs sm:text-sm md:text-base group-hover:text-black-700 transition-colors break-words leading-tight">
              {product.name}
            </h3>
            <div className="mt-1 flex items-baseline gap-1 min-w-0">
              <span className="text-xs sm:text-sm font-bold text-black-700 truncate">
                Rs {product.stockPrice.toFixed(0)}
              </span>
              <span className="text-[10px] sm:text-xs text-gray-400 line-through truncate">
                Rs {product.retailPrice.toFixed(0)}
              </span>
            </div>
          </Link>
        </div>

        {/* Quick Add Controls - expand on hover */}
        {hasStock && (
          <div
            className={`max-h-0 overflow-hidden transition-all duration-500 ease-out ${
              showMobilePanel ? 'max-h-[180px]' : 'group-hover:max-h-[180px]'
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-2 sm:p-3 rounded-t-lg">
              {/* Size buttons */}
              <div
                className={`flex flex-wrap gap-1 mb-2 ${
                  needsSelection === 'size' ? 'ring-1 ring-red-400 rounded p-0.5 animate-pulse' : ''
                }`}
              >
                {sizes.map((size) => (
                  <button
                    key={size}
                    onClick={(e) => {
                      e.stopPropagation()
                      e.preventDefault()
                      setSelectedSize(selectedSize === size ? null : size)
                    }}
                    className={`h-6 px-1.5 text-[10px] font-medium rounded transition-colors ${
                      selectedSize === size
                        ? 'bg-black-700 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {size}
                  </button>
                ))}
              </div>

              {/* Color circles + Action buttons */}
              <div className="flex items-center justify-between">
                <div
                  className={`flex flex-wrap gap-1 ${
                    needsSelection === 'color'
                      ? 'ring-1 ring-red-400 rounded p-0.5 animate-pulse'
                      : ''
                  }`}
                >
                  {colors.map((color) => (
                    <button
                      key={color}
                      onClick={(e) => {
                        e.stopPropagation()
                        e.preventDefault()
                        setSelectedColor(selectedColor === color ? null : color)
                      }}
                      className={`h-5 w-5 rounded-full border-2 transition-all ${
                        selectedColor === color
                          ? 'border-black-700 ring-1 ring-gray-300'
                          : 'border-gray-300 hover:border-gray-400'
                      }`}
                      style={{ backgroundColor: getColorHex(color) }}
                      title={color}
                    />
                  ))}
                </div>

                <div className="flex gap-1.5">
                  {/* Add to Cart */}
                  <button
                    onClick={handleAddToCart}
                    disabled={isAdding || (selectedVariant !== null && !isVariantAvailable)}
                    title={t('addToCart')}
                    className="flex h-7 w-7 items-center justify-center rounded-full bg-black-700 text-white transition-colors hover:bg-black-800 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isAdding ? (
                      <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                    ) : (
                      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                      </svg>
                    )}
                  </button>

                  {/* Quick Buy */}
                  <button
                    onClick={handleQuickBuy}
                    disabled={isQuickBuying || (selectedVariant !== null && !isVariantAvailable)}
                    title={t('quickBuy')}
                    className="flex h-7 w-7 items-center justify-center rounded-full bg-black-800 text-white transition-colors hover:bg-coral-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isQuickBuying ? (
                      <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                    ) : (
                      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
