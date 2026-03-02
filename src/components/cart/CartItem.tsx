'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useState } from 'react'
import { useLocale } from 'next-intl'
import type { CartItemWithDetails } from '@/lib/repositories/cart.repository'
import { removeFromCartAction, updateCartItemAction } from '@/app/actions/cart'
import { getColorHex } from '@/lib/color-utils'

interface CartItemProps {
  item: CartItemWithDetails
  onUpdate: () => void
}

export default function CartItem({ item, onUpdate }: CartItemProps) {
  const locale = useLocale()
  const [isUpdating, setIsUpdating] = useState(false)
  const [quantity, setQuantity] = useState(item.quantity)

  const handleQuantityChange = async (newQuantity: number) => {
    if (newQuantity < 1 || newQuantity > item.variant.stockQuantity) return

    setIsUpdating(true)
    setQuantity(newQuantity)

    const result = await updateCartItemAction(item.variantId, newQuantity)

    if (result.success) {
      onUpdate()
    }

    setIsUpdating(false)
  }

  const handleRemove = async () => {
    setIsUpdating(true)
    const result = await removeFromCartAction(item.variantId)

    if (result.success) {
      onUpdate()
    } else {
      setIsUpdating(false)
    }
  }

  const itemTotal = item.product.stockPrice * quantity

  return (
    <div className="flex gap-4 border-b border-gray-200 py-6">
      {/* Product Image */}
      <Link
        href={`/${locale}/product/${item.product.id}`}
        className="relative h-24 w-24 flex-shrink-0 overflow-hidden rounded-lg bg-gray-100"
      >
        {item.product.images?.[0] ? (
          <Image
            src={item.product.images[0]}
            alt={item.product.name}
            fill
            className="object-cover"
            sizes="96px"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-gray-400 text-xs">
            No Image
          </div>
        )}
      </Link>

      {/* Product Details */}
      <div className="flex flex-1 flex-col">
        <div className="flex justify-between">
          <div className="flex-1">
            <Link
              href={`/${locale}/product/${item.product.id}`}
              className="text-sm font-semibold text-gray-900 hover:text-navy-600 transition-colors"
            >
              {item.product.name}
            </Link>
            <p className="mt-1 text-xs text-gray-600">{item.product.brand}</p>
            <div className="mt-2 flex items-center gap-3 text-xs text-gray-600">
              <span>Size: {item.variant.size}</span>
              <span>•</span>
              <div className="flex items-center gap-1.5">
                <span>Color:</span>
                <span
                  className="h-4 w-4 rounded-full border border-gray-300 inline-block"
                  style={{ backgroundColor: getColorHex(item.variant.color) }}
                  title={item.variant.color}
                />
                <span className="capitalize">{item.variant.color}</span>
              </div>
            </div>
          </div>

          {/* Price */}
          <div className="text-right">
            <p className="text-sm font-bold text-navy-600">
              Rs {itemTotal.toFixed(2)}
            </p>
            <p className="text-xs text-gray-500">
              Rs {item.product.stockPrice.toFixed(2)} each
            </p>
          </div>
        </div>

        {/* Quantity Controls and Remove Button */}
        <div className="mt-4 flex items-center justify-between">
          {/* Quantity Selector */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleQuantityChange(quantity - 1)}
              disabled={isUpdating || quantity <= 1}
              className="h-8 w-8 rounded-md border border-gray-300 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              −
            </button>
            <span className="w-12 text-center text-sm font-medium">{quantity}</span>
            <button
              onClick={() => handleQuantityChange(quantity + 1)}
              disabled={isUpdating || quantity >= item.variant.stockQuantity}
              className="h-8 w-8 rounded-md border border-gray-300 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              +
            </button>
          </div>

          {/* Remove Button */}
          <button
            onClick={handleRemove}
            disabled={isUpdating}
            className="text-sm text-red-600 hover:text-red-700 disabled:opacity-50 transition-colors"
          >
            Remove
          </button>
        </div>

        {/* Stock Warning */}
        {item.variant.stockQuantity < 5 && (
          <p className="mt-2 text-xs text-orange-600">
            Only {item.variant.stockQuantity} left in stock
          </p>
        )}
      </div>
    </div>
  )
}
