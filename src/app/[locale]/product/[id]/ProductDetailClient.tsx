'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useTranslations, useLocale } from 'next-intl'
import type { ProductWithVariants } from '@/lib/repositories/product.repository'
import { trackProductViewAction } from '@/app/actions/user-profile'
import { getColorHex } from '@/lib/color-utils'
import { useCartStore } from '@/stores/cartStore'

interface ProductDetailClientProps {
  product: ProductWithVariants
}

export default function ProductDetailClient({ product }: ProductDetailClientProps) {
  const router = useRouter()
  const locale = useLocale()
  const t = useTranslations('product')
  const tNav = useTranslations('nav')
  const { addToCart, isAdding: isAddingToCart } = useCartStore()
  const [selectedSize, setSelectedSize] = useState<string | null>(null)
  const [selectedColor, setSelectedColor] = useState<string | null>(null)
  const [isAdding, setIsAdding] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [currentImageIndex, setCurrentImageIndex] = useState(0)

  // Track product view on mount
  useEffect(() => {
    trackProductViewAction(product.id)
  }, [product.id])

  // Group variants by size and color
  const sizes = Array.from(new Set(product.variants.map((v) => v.size)))
  const colors = Array.from(new Set(product.variants.map((v) => v.color)))

  // Calculate total stock
  const totalStock = product.variants.reduce((sum, v) => sum + v.stockQuantity, 0)
  const hasStock = totalStock > 0

  // Calculate discount
  const discountPercent = Math.round(
    ((product.retailPrice - product.stockPrice) / product.retailPrice) * 100
  )
  const savings = product.retailPrice - product.stockPrice

  // Find selected variant
  const selectedVariant =
    selectedSize && selectedColor
      ? product.variants.find((v) => v.size === selectedSize && v.color === selectedColor)
      : null

  // Get available colors for selected size
  const availableColors = selectedSize
    ? Array.from(
        new Set(
          product.variants.filter((v) => v.size === selectedSize && v.stockQuantity > 0).map((v) => v.color)
        )
      )
    : colors

  // Get available sizes for selected color
  const availableSizes = selectedColor
    ? Array.from(
        new Set(
          product.variants.filter((v) => v.color === selectedColor && v.stockQuantity > 0).map((v) => v.size)
        )
      )
    : sizes

  // Get product images array
  const productImages = product.images && product.images.length > 0 ? product.images : []
  const displayImage = productImages[currentImageIndex]

  const handleAddToCart = async () => {
    if (!selectedVariant) {
      setMessage({ type: 'error', text: t('pleaseSelectSizeAndColor') })
      return
    }

    setIsAdding(true)
    setMessage(null)

    const success = await addToCart(selectedVariant.id, 1)

    if (success) {
      setMessage({ type: 'success', text: t('addedToCart') })
      // Clear message after 3 seconds
      setTimeout(() => setMessage(null), 3000)
    } else {
      setMessage({ type: 'error', text: t('failedToAddToCart') })
    }

    setIsAdding(false)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Breadcrumb */}
      <div className="bg-white border-b border-gray-200">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
          <nav className="flex items-center gap-2 text-sm text-gray-600">
            <Link href={`/${locale}`} className="hover:text-black-700 transition-colors">
              {t('home')}
            </Link>
            <span>/</span>
            <Link href={`/${locale}/shop`} className="hover:text-black-700 transition-colors">
              {tNav('shop')}
            </Link>
            <span>/</span>
            <span className="text-black-700">{product.name}</span>
          </nav>
        </div>
      </div>

      {/* Product Detail */}
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
          {/* Image Gallery */}
          <div className="space-y-4">
            {/* Main Image */}
            <div className="relative aspect-[3/4] overflow-hidden rounded-lg bg-gray-100 group">
              {displayImage ? (
                <Image
                  src={displayImage}
                  alt={product.name}
                  fill
                  className="object-cover"
                  priority
                  sizes="(max-width: 1024px) 100vw, 50vw"
                />
              ) : (
                <div className="flex h-full items-center justify-center text-gray-400">
                  {t('noImage')}
                </div>
              )}

              {/* Discount Badge */}
              {discountPercent > 0 && (
                <div className="absolute right-4 top-4 rounded-full bg-gray-500 px-4 py-2 text-sm font-bold text-black-700 shadow-lg">
                  {t('discountBadge', { percent: discountPercent })}
                </div>
              )}

              {/* Navigation Arrows - Only show if multiple images */}
              {productImages.length > 1 && (
                <>
                  <button
                    onClick={() => setCurrentImageIndex((prev) => (prev === 0 ? productImages.length - 1 : prev - 1))}
                    className="absolute left-4 top-1/2 -translate-y-1/2 bg-white/80 hover:bg-white rounded-full p-2 shadow-lg opacity-0 group-hover:opacity-100 transition-opacity"
                    aria-label="Previous image"
                  >
                    <svg className="w-6 h-6 text-black-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                  </button>
                  <button
                    onClick={() => setCurrentImageIndex((prev) => (prev === productImages.length - 1 ? 0 : prev + 1))}
                    className="absolute right-4 top-1/2 -translate-y-1/2 bg-white/80 hover:bg-white rounded-full p-2 shadow-lg opacity-0 group-hover:opacity-100 transition-opacity"
                    aria-label="Next image"
                  >
                    <svg className="w-6 h-6 text-black-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>

                  {/* Image Counter */}
                  <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/50 text-white px-3 py-1 rounded-full text-sm">
                    {currentImageIndex + 1} / {productImages.length}
                  </div>
                </>
              )}
            </div>

            {/* Thumbnail Strip - Only show if multiple images */}
            {productImages.length > 1 && (
              <div className="grid grid-cols-4 gap-4">
                {productImages.map((image, index) => (
                  <button
                    key={index}
                    onClick={() => setCurrentImageIndex(index)}
                    className={`relative aspect-square rounded-lg overflow-hidden border-2 transition-all ${
                      currentImageIndex === index
                        ? 'border-black-700 ring-2 ring-black-700 ring-offset-2'
                        : 'border-gray-200 hover:border-gray-400'
                    }`}
                  >
                    <Image
                      src={image}
                      alt={`${product.name} - Image ${index + 1}`}
                      fill
                      className="object-cover"
                      sizes="25vw"
                    />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Product Info */}
          <div className="space-y-6">
            {/* Brand */}
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-gray-600">
                {product.brand}
              </p>
              <h1 className="mt-2 text-3xl font-bold text-black-700">{product.name}</h1>
              <p className="mt-2 text-sm text-gray-600">
                {product.gender}
              </p>
            </div>

            {/* Price */}
            <div className="space-y-2 border-y border-gray-200 py-6">
              <div className="flex items-baseline gap-3">
                <span className="text-4xl font-bold text-black-700">
                  Rs {product.stockPrice.toFixed(2)}
                </span>
                <span className="text-xl text-gray-400 line-through">
                  Rs {product.retailPrice.toFixed(2)}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="inline-block rounded-full bg-gray-100 px-3 py-1 text-sm font-semibold text-black-700">
                  {t('saveAmount', { amount: savings.toFixed(2), percent: discountPercent })}
                </span>
                <span className="text-sm text-gray-600">{t('stockPrice')}</span>
              </div>
            </div>

            {/* Description */}
            <div>
              <h2 className="text-lg font-semibold text-black-700">{t('description')}</h2>
              <p className="mt-2 text-gray-600 leading-relaxed">{product.description}</p>
            </div>

            {/* Size Selection */}
            <div>
              <h3 className="text-sm font-semibold text-black-700">
                {t('selectSize')} {selectedSize && <span className="text-black-700">({selectedSize})</span>}
              </h3>
              <div className="mt-3 flex flex-wrap gap-2">
                {sizes.map((size) => {
                  const sizeVariants = product.variants.filter((v) => v.size === size)
                  const sizeStock = sizeVariants.reduce((sum, v) => sum + v.stockQuantity, 0)
                  const inStock = sizeStock > 0
                  const isSelected = selectedSize === size
                  const isAvailable = !selectedColor || availableSizes.includes(size)

                  return (
                    <button
                      key={size}
                      disabled={!inStock || !isAvailable}
                      onClick={() => setSelectedSize(size)}
                      className={`
                        px-6 py-3 rounded-md font-medium transition-all duration-200
                        ${
                          isSelected
                            ? 'bg-black-700 text-white border-2 border-black-700'
                            : inStock && isAvailable
                            ? 'bg-white border-2 border-gray-300 hover:border-black-700 hover:bg-gray-50 cursor-pointer'
                            : 'bg-gray-100 border-2 border-gray-200 text-gray-400 cursor-not-allowed line-through'
                        }
                      `}
                    >
                      {size}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Color Selection */}
            <div>
              <h3 className="text-sm font-semibold text-black-700">
                {t('selectColor')} {selectedColor && <span className="text-black-700">({selectedColor})</span>}
              </h3>
              <div className="mt-3 flex flex-wrap gap-3">
                {colors.map((color) => {
                  const colorVariants = product.variants.filter((v) => v.color === color)
                  const colorStock = colorVariants.reduce((sum, v) => sum + v.stockQuantity, 0)
                  const inStock = colorStock > 0
                  const isSelected = selectedColor === color
                  const isAvailable = !selectedSize || availableColors.includes(color)

                  return (
                    <button
                      key={color}
                      disabled={!inStock || !isAvailable}
                      onClick={() => setSelectedColor(color)}
                      className={`
                        flex items-center gap-2 px-4 py-2 rounded-md border-2 transition-all duration-200
                        ${
                          isSelected
                            ? 'border-black-700 bg-gray-50'
                            : inStock && isAvailable
                            ? 'border-gray-300 hover:border-black-700 hover:bg-gray-50 cursor-pointer'
                            : 'border-gray-200 bg-gray-100 cursor-not-allowed opacity-50'
                        }
                      `}
                    >
                      <div
                        className="h-6 w-6 rounded-full border border-gray-300"
                        style={{
                          backgroundColor: getColorHex(color),
                        }}
                      />
                      <span className="text-sm font-medium">{color}</span>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Stock Status */}
            <div className="rounded-lg bg-gray-100 p-4">
              {selectedVariant ? (
                <div className="flex items-center gap-2">
                  <div
                    className={`h-3 w-3 rounded-full ${
                      selectedVariant.stockQuantity > 0 ? 'bg-green-500' : 'bg-red-500'
                    }`}
                  />
                  <span className="text-sm font-medium text-black-700">
                    {selectedVariant.stockQuantity > 0
                      ? selectedVariant.stockQuantity < 10
                        ? t('onlyLeft', { count: selectedVariant.stockQuantity })
                        : t('inStock')
                      : t('outOfStock')}
                  </span>
                </div>
              ) : hasStock ? (
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full bg-green-500" />
                  <span className="text-sm font-medium text-black-700">
                    {totalStock < 10 ? t('onlyLeft', { count: totalStock }) : t('inStock')}
                  </span>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full bg-red-500" />
                  <span className="text-sm font-medium text-black-700">{t('outOfStock')}</span>
                </div>
              )}
            </div>

            {/* Message */}
            {message && (
              <div
                className={`rounded-lg p-4 ${
                  message.type === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
                }`}
              >
                <p className="text-sm font-medium">{message.text}</p>
              </div>
            )}

            {/* Add to Cart Button */}
            <div className="space-y-3">
              <button
                onClick={handleAddToCart}
                disabled={!selectedVariant || selectedVariant.stockQuantity === 0 || isAdding || isAddingToCart}
                className="btn-primary w-full text-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isAdding || isAddingToCart
                  ? t('adding')
                  : !selectedSize || !selectedColor
                  ? t('selectSizeAndColor')
                  : selectedVariant && selectedVariant.stockQuantity > 0
                  ? t('addToCart')
                  : t('outOfStock')}
              </button>
              <p className="text-center text-xs text-gray-500">{t('freeShipping')}</p>
            </div>

            {/* Product Details */}
            <div className="border-t border-gray-200 pt-6 space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">{t('sku')}</span>
                <span className="font-medium text-black-700">{product.sku}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">{t('category')}</span>
                <span className="font-medium text-black-700">{product.category}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">{t('gender')}</span>
                <span className="font-medium text-black-700">{product.gender}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="mt-12 flex flex-col sm:flex-row justify-center gap-3 sm:gap-4">
          <Link href={`/${locale}/shop`} className="btn-secondary text-center">
            {t('backToShop')}
          </Link>
          <Link href={`/${locale}/cart`} className="btn-primary text-center">
            {t('viewCart')}
          </Link>
        </div>
      </div>
    </div>
  )
}
