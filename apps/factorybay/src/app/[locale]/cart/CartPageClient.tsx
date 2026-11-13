'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useTranslations, useLocale } from 'next-intl'
import CartItem from '@/components/cart/CartItem'
import type { v1 } from '@softx/contract'
import { useCartStore } from '@/stores/cartStore'
import { amount, cartRetailTotal } from '@/lib/price'
import ConfirmDialog from '@/components/ui/ConfirmDialog'

interface CartPageClientProps {
  initialItems: v1.CartItemDTO[]
  initialTotal: v1.Money
  initialItemCount: number
}

export default function CartPageClient({
  initialItems,
  initialTotal,
  initialItemCount,
}: CartPageClientProps) {
  const locale = useLocale()
  const t = useTranslations('cart')
  const store = useCartStore()
  const [isClearing, setIsClearing] = useState(false)

  // LKD-31: the store is a module singleton that starts empty, so the SSR
  // HTML (and first client render) painted "0 items / Rs 0.00" until
  // Navigation's loadCart() resolved a second or two later — the cart looked
  // wiped on every full page load. Until the store has loaded from the
  // server, render the projection the server component already fetched
  // (initialItems/initialTotal/initialItemCount — per-request props, safe to
  // SSR; seeding the global store during render would leak across requests).
  // Once any projection lands (loadCart or a mutation), the store is
  // authoritative. CheckoutPageClient already follows this props-first shape.
  const items = store.hasLoaded ? store.items : initialItems
  const total = store.hasLoaded ? store.total : initialTotal
  const itemCount = store.hasLoaded ? store.itemCount : initialItemCount
  const isLoading = store.isLoading
  const clearCart = store.clearCart

  // Confirm dialog state
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean
    title: string
    message: string
    onConfirm: () => void
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
  })

  // Load cart on mount to ensure fresh data
  useEffect(() => {
    // Store is already loaded by Navigation, but we can reload here if needed
  }, [])

  const handleClearCart = async () => {
    setConfirmDialog({
      isOpen: true,
      title: 'Clear Cart',
      message: t('clearCartConfirm'),
      onConfirm: async () => {
        setConfirmDialog({ ...confirmDialog, isOpen: false })
        setIsClearing(true)
        await clearCart()
        setIsClearing(false)
      }
    })
  }

  // Calculate savings (Money totals from the CartService projection)
  const totalAmount = amount(total)
  const retailTotal = cartRetailTotal(items)
  const savings = retailTotal - totalAmount

  // Empty state — mirrors the server component's (cart/page.tsx). Without
  // this branch the client-rendered page kept showing the order summary and
  // a live checkout CTA after the last item was removed (LKD-7).
  if (!isLoading && items.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <h1 className="text-3xl font-bold text-black-700">{t('title')}</h1>

          <div className="mt-12 flex flex-col items-center justify-center">
            <div className="text-center">
              <svg
                className="mx-auto h-24 w-24 text-gray-300"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"
                />
              </svg>
              <h2 className="mt-6 text-xl font-semibold text-black-700">
                {t('empty')}
              </h2>
              <p className="mt-2 text-gray-600">
                {t('emptyMessage')}
              </p>
              <Link href={`/${locale}/shop`} className="btn-primary mt-8 inline-block">
                {t('startShopping')}
              </Link>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-black-700">{t('title')}</h1>
              <p className="mt-2 text-gray-600">
                {t('itemsInCart', { count: itemCount })}
              </p>
            </div>
            {items.length > 0 && (
              <button
                onClick={handleClearCart}
                disabled={isClearing}
                className="text-sm text-red-600 hover:text-red-700 disabled:opacity-50"
              >
                {t('clearCart')}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Cart Content */}
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
          {/* Cart Items */}
          <div className="lg:col-span-2">
            <div className="rounded-lg bg-white p-6 shadow-sm">
              {items.map((item) => (
                <CartItem key={item.variantId} item={item} />
              ))}
            </div>

            {/* Continue Shopping */}
            <div className="mt-6">
              <Link href={`/${locale}/shop`} className="btn-secondary">
                {t('continueShopping')}
              </Link>
            </div>
          </div>

          {/* Order Summary */}
          <div className="lg:col-span-1">
            <div className="rounded-lg bg-white p-6 shadow-sm sticky top-4">
              <h2 className="text-lg font-bold text-black-700">{t('summary')}</h2>

              <div className="mt-6 space-y-4">
                {/* Subtotal */}
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">{t('subtotal')}</span>
                  <span className="font-medium text-black-700">
                    Rs {totalAmount.toFixed(2)}
                  </span>
                </div>

                {/* Retail Price */}
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">{t('retailTotal')}</span>
                  <span className="font-medium text-gray-400 line-through">
                    Rs {retailTotal.toFixed(2)}
                  </span>
                </div>

                {/* Savings */}
                {savings > 0 && (
                  <div className="flex justify-between rounded-lg bg-gray-100 px-3 py-2">
                    <span className="text-sm font-semibold text-black-700">
                      {t('youSave')}
                    </span>
                    <span className="text-sm font-bold text-black-700">
                      Rs {savings.toFixed(2)}
                    </span>
                  </div>
                )}

                {/* Shipping */}
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">{t('shipping')}</span>
                  <span className="font-medium text-black-700">
                    {totalAmount >= 100 ? t('free') : 'Rs 9.99'}
                  </span>
                </div>

                {/* Free shipping notice */}
                {totalAmount < 100 && (
                  <p className="text-xs text-gray-500">
                    {t('addMoreForFreeShipping', { amount: (100 - totalAmount).toFixed(2) })}
                  </p>
                )}

                {/* Total */}
                <div className="border-t border-gray-200 pt-4">
                  <div className="flex justify-between">
                    <span className="text-base font-bold text-black-700">{t('total')}</span>
                    <span className="text-2xl font-bold text-black-700">
                      Rs {(totalAmount + (totalAmount >= 100 ? 0 : 9.99)).toFixed(2)}
                    </span>
                  </div>
                </div>

                {/* Checkout Button */}
                <Link href={`/${locale}/checkout`} className="btn-primary w-full text-lg mt-6 text-center block">
                  {t('proceedToCheckout')}
                </Link>

                <p className="text-center text-xs text-gray-500 mt-4">
                  {t('secureCheckout')}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Confirm Dialog */}
      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        title={confirmDialog.title}
        message={confirmDialog.message}
        onConfirm={confirmDialog.onConfirm}
        onCancel={() => setConfirmDialog({ ...confirmDialog, isOpen: false })}
      />
    </div>
  )
}
