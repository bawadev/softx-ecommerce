'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { useTranslations, useLocale } from 'next-intl'
import type { CartItemWithDetails } from '@/lib/repositories/cart.repository'
import type { ShippingAddress, DeliveryMethod } from '@/lib/types'
import { createOrderAction } from '@/app/actions/order'
import { getColorHex } from '@/lib/color-utils'
import Input from '@/components/ui/Input'
import Button from '@/components/ui/Button'

interface CheckoutPageClientProps {
  items: CartItemWithDetails[]
  total: number
  itemCount: number
  userEmail?: string
  isAuthenticated: boolean
}

export default function CheckoutPageClient({
  items,
  total,
  itemCount,
  userEmail,
  isAuthenticated,
}: CheckoutPageClientProps) {
  const locale = useLocale()
  const t = useTranslations('checkout')
  const tCommon = useTranslations('common')
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [email, setEmail] = useState(userEmail || '')
  const [showLoginModal, setShowLoginModal] = useState(false)
  const [deliveryMethod, setDeliveryMethod] = useState<DeliveryMethod>('SHIP')

  const [shippingAddress, setShippingAddress] = useState<ShippingAddress>({
    fullName: '',
    addressLine1: '',
    addressLine2: '',
    city: '',
    state: '',
    postalCode: '',
    country: 'United States',
    phone: '',
  })

  // Calculate shipping based on delivery method
  const shipping = deliveryMethod === 'SHIP' ? (total >= 100 ? 0 : 9.99) : 0
  const finalTotal = total + shipping

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    // Check if user is authenticated before placing order
    if (!isAuthenticated) {
      setShowLoginModal(true)
      return
    }

    setIsSubmitting(true)

    try {
      const result = await createOrderAction(shippingAddress, deliveryMethod, email)

      if (result.success && result.data) {
        // Redirect to order confirmation page
        router.push(`/${locale}/order/${result.data.orderId}`)
      } else {
        setError(result.message || 'Failed to place order')
      }
    } catch (err) {
      setError('An unexpected error occurred')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <h1 className="text-3xl font-bold text-navy-900">{t('title')}</h1>
          <p className="mt-2 text-gray-600">{t('subtitle')}</p>
        </div>
      </div>

      {/* Content */}
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
          {/* Shipping Form */}
          <div className="lg:col-span-2">
            <div className="rounded-lg bg-white p-6 shadow-sm">
              <h2 className="text-xl font-bold text-gray-900 mb-6">{t('shippingInformation')}</h2>

              {error && (
                <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-5">
                {!isAuthenticated && (
                  <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <div className="flex items-start gap-3">
                      <svg className="w-5 h-5 text-blue-600 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                      </svg>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-blue-900">
                          {t('guestCheckoutNotice')}
                        </p>
                        <p className="mt-1 text-sm text-blue-700">
                          {t('guestCheckoutBenefits')}
                        </p>
                        <Link href={`/${locale}/signup`} className="mt-2 inline-block text-sm font-medium text-blue-600 hover:text-blue-700 underline">
                          {t('createAccount')} →
                        </Link>
                      </div>
                    </div>
                  </div>
                )}

                <Input
                  id="fullName"
                  type="text"
                  label={t('fullName')}
                  placeholder={t('fullNamePlaceholder')}
                  value={shippingAddress.fullName}
                  onChange={(e) =>
                    setShippingAddress({ ...shippingAddress, fullName: e.target.value })
                  }
                  required
                />

                <Input
                  id="email"
                  type="email"
                  label={t('email')}
                  placeholder={t('emailPlaceholder')}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isAuthenticated}
                  hint={isAuthenticated ? t('emailHint') : t('emailOptionalHint')}
                />

                <Input
                  id="phone"
                  type="tel"
                  label={t('phone')}
                  placeholder={t('phonePlaceholder')}
                  value={shippingAddress.phone}
                  onChange={(e) =>
                    setShippingAddress({ ...shippingAddress, phone: e.target.value })
                  }
                  required
                />

                {/* Delivery Method Selection */}
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-3">
                    {t('deliveryMethod')}
                  </label>
                  <div className="space-y-3">
                    <label className="flex items-center gap-3 p-4 border-2 rounded-lg cursor-pointer transition-all hover:bg-gray-50"
                      style={{ borderColor: deliveryMethod === 'SHIP' ? '#1e3a8a' : '#d1d5db' }}>
                      <input
                        type="radio"
                        name="deliveryMethod"
                        value="SHIP"
                        checked={deliveryMethod === 'SHIP'}
                        onChange={() => setDeliveryMethod('SHIP')}
                        className="h-4 w-4 text-navy-600"
                      />
                      <div className="flex-1">
                        <div className="font-semibold text-gray-900">{t('ship')}</div>
                        <div className="text-sm text-gray-600">{t('shipDescription')}</div>
                      </div>
                      <div className="text-sm font-medium text-gray-900">
                        {total >= 100 ? t('free') : 'Rs 9.99'}
                      </div>
                    </label>

                    <label className="flex items-center gap-3 p-4 border-2 rounded-lg cursor-pointer transition-all hover:bg-gray-50"
                      style={{ borderColor: deliveryMethod === 'COLLECT' ? '#1e3a8a' : '#d1d5db' }}>
                      <input
                        type="radio"
                        name="deliveryMethod"
                        value="COLLECT"
                        checked={deliveryMethod === 'COLLECT'}
                        onChange={() => setDeliveryMethod('COLLECT')}
                        className="h-4 w-4 text-navy-600"
                      />
                      <div className="flex-1">
                        <div className="font-semibold text-gray-900">{t('collect')}</div>
                        <div className="text-sm text-gray-600">{t('collectDescription')}</div>
                      </div>
                      <div className="text-sm font-medium text-green-600">{t('free')}</div>
                    </label>
                  </div>
                </div>

                <Input
                  id="addressLine1"
                  type="text"
                  label={t('addressLine1')}
                  placeholder={t('addressLine1Placeholder')}
                  value={shippingAddress.addressLine1}
                  onChange={(e) =>
                    setShippingAddress({ ...shippingAddress, addressLine1: e.target.value })
                  }
                  required
                />

                <Input
                  id="addressLine2"
                  type="text"
                  label={t('addressLine2')}
                  placeholder={t('addressLine2Placeholder')}
                  value={shippingAddress.addressLine2}
                  onChange={(e) =>
                    setShippingAddress({ ...shippingAddress, addressLine2: e.target.value })
                  }
                />

                <div className="grid grid-cols-2 gap-4">
                  <Input
                    id="city"
                    type="text"
                    label={t('city')}
                    placeholder={t('cityPlaceholder')}
                    value={shippingAddress.city}
                    onChange={(e) =>
                      setShippingAddress({ ...shippingAddress, city: e.target.value })
                    }
                    required
                  />

                  <Input
                    id="state"
                    type="text"
                    label={t('state')}
                    placeholder={t('statePlaceholder')}
                    value={shippingAddress.state}
                    onChange={(e) =>
                      setShippingAddress({ ...shippingAddress, state: e.target.value })
                    }
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <Input
                    id="postalCode"
                    type="text"
                    label={t('postalCode')}
                    placeholder={t('postalCodePlaceholder')}
                    value={shippingAddress.postalCode}
                    onChange={(e) =>
                      setShippingAddress({ ...shippingAddress, postalCode: e.target.value })
                    }
                    required
                  />

                  <Input
                    id="country"
                    type="text"
                    label={t('country')}
                    value={shippingAddress.country}
                    onChange={(e) =>
                      setShippingAddress({ ...shippingAddress, country: e.target.value })
                    }
                    required
                  />
                </div>

                <div className="flex gap-4 pt-4">
                  <Link href={`/${locale}/cart`} className="btn-secondary flex-1">
                    {t('backToCart')}
                  </Link>
                  <Button type="submit" className="flex-1" isLoading={isSubmitting}>
                    {t('placeOrder')}
                  </Button>
                </div>
              </form>
            </div>
          </div>

          {/* Order Summary */}
          <div className="lg:col-span-1">
            <div className="rounded-lg bg-white p-6 shadow-sm sticky top-4">
              <h2 className="text-lg font-bold text-gray-900 mb-4">{t('orderSummary')}</h2>

              {/* Items */}
              <div className="space-y-3 mb-6">
                {items.map((item) => (
                  <div key={item.id} className="flex gap-3">
                    <div className="relative h-16 w-16 flex-shrink-0 overflow-hidden rounded-lg bg-gray-100">
                      {item.variant.images?.[0] ? (
                        <Image
                          src={item.variant.images[0]}
                          alt={item.product.name}
                          fill
                          className="object-cover"
                          sizes="64px"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center text-gray-400 text-xs">
                          {t('noImage')}
                        </div>
                      )}
                    </div>
                    <div className="flex-1 text-sm">
                      <p className="font-medium text-gray-900">{item.product.name}</p>
                      <p className="text-gray-600">{item.product.brand}</p>
                      <div className="flex items-center gap-2 text-gray-600">
                        <span>{item.variant.size}</span>
                        <span>•</span>
                        <div className="flex items-center gap-1">
                          <span
                            className="h-3 w-3 rounded-full border border-gray-300 inline-block"
                            style={{ backgroundColor: getColorHex(item.variant.color) }}
                            title={item.variant.color}
                          />
                          <span className="capitalize text-xs">{item.variant.color}</span>
                        </div>
                        <span>•</span>
                        <span>× {item.quantity}</span>
                      </div>
                    </div>
                    <div className="text-sm font-medium text-gray-900">
                      Rs {(item.product.stockPrice * item.quantity).toFixed(2)}
                    </div>
                  </div>
                ))}
              </div>

              {/* Totals */}
              <div className="space-y-3 border-t border-gray-200 pt-4">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">{t('subtotalItems', { count: itemCount })}</span>
                  <span className="font-medium text-gray-900">Rs {total.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">{t('shipping')}</span>
                  <span className={`font-medium ${shipping === 0 ? 'text-green-600' : 'text-gray-900'}`}>
                    {shipping === 0 ? t('free') : `$Rs {shipping.toFixed(2)}`}
                  </span>
                </div>
                <div className="flex justify-between border-t border-gray-200 pt-3">
                  <span className="text-base font-bold text-gray-900">{t('total')}</span>
                  <span className="text-2xl font-bold text-navy-600">
                    Rs {finalTotal.toFixed(2)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Login Modal */}
      {showLoginModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-screen items-center justify-center p-4">
            {/* Backdrop */}
            <div
              className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
              onClick={() => setShowLoginModal(false)}
            />

            {/* Modal */}
            <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full p-6 z-10">
              <button
                onClick={() => setShowLoginModal(false)}
                className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
              >
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>

              <div className="text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-navy-100 mb-4">
                  <svg className="h-6 w-6 text-navy-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">{t('loginRequired')}</h3>
                <p className="text-gray-600 mb-6">{t('loginRequiredMessage')}</p>

                <div className="space-y-3">
                  <Link
                    href={`/${locale}/login?redirect=${encodeURIComponent(`/${locale}/checkout`)}`}
                    className="block w-full bg-navy-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-navy-700 transition-colors"
                  >
                    {t('signIn')}
                  </Link>
                  <Link
                    href={`/${locale}/signup?redirect=${encodeURIComponent(`/${locale}/checkout`)}`}
                    className="block w-full bg-white border-2 border-navy-600 text-navy-600 px-6 py-3 rounded-lg font-semibold hover:bg-navy-50 transition-colors"
                  >
                    {t('createAccount')}
                  </Link>
                  <button
                    onClick={() => setShowLoginModal(false)}
                    className="w-full text-sm text-gray-600 hover:text-gray-800 py-2"
                  >
                    {tCommon('cancel')}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
