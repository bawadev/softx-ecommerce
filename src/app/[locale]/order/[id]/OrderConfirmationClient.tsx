'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useTranslations, useLocale } from 'next-intl'
import type { OrderWithItems } from '@/lib/repositories/order.repository'

interface OrderConfirmationClientProps {
  order: OrderWithItems
}

export default function OrderConfirmationClient({ order }: OrderConfirmationClientProps) {
  const locale = useLocale()
  const t = useTranslations('order.confirmation')
  const tStatus = useTranslations('order.status')

  const orderDate = new Date(order.createdAt).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  const shipping = order.totalAmount < 100 ? 9.99 : 0
  const subtotal = order.totalAmount - shipping

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Success Header */}
      <div className="bg-green-600 text-white">
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-white mb-4">
            <svg
              className="h-10 w-10 text-green-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
          <h1 className="text-3xl font-bold">{t('title')}</h1>
          <p className="mt-2 text-green-100">{t('subtitle')}</p>
        </div>
      </div>

      {/* Order Details */}
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
          {/* Order Info */}
          <div className="lg:col-span-2 space-y-6">
            {/* Order Number */}
            <div className="rounded-lg bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">{t('orderNumber')}</p>
                  <p className="text-2xl font-bold text-black-700">{order.orderNumber}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-gray-600">{t('orderDate')}</p>
                  <p className="font-medium text-black-700">{orderDate}</p>
                </div>
              </div>
              <div className="mt-4">
                <span
                  className={`inline-block rounded-full px-3 py-1 text-sm font-semibold ${
                    order.status === 'PENDING'
                      ? 'bg-gray-100 text-black-700'
                      : order.status === 'CONFIRMED'
                      ? 'bg-gray-100 text-black-700'
                      : order.status === 'FULFILLED'
                      ? 'bg-green-100 text-green-700'
                      : 'bg-red-100 text-red-700'
                  }`}
                >
                  {tStatus(order.status)}
                </span>
              </div>
            </div>

            {/* Order Items */}
            <div className="rounded-lg bg-white p-6 shadow-sm">
              <h2 className="text-lg font-bold text-black-700 mb-4">{t('items')}</h2>
              <div className="space-y-4">
                {order.items.map((item) => (
                  <div key={item.id} className="flex gap-4 border-b border-gray-200 pb-4 last:border-0">
                    <Link
                      href={`/${locale}/product/${item.product.id}`}
                      className="relative h-20 w-20 flex-shrink-0 overflow-hidden rounded-lg bg-gray-100"
                    >
                      {(item.variant.images?.[0] || item.product.images?.[0]) ? (
                        <Image
                          src={item.variant.images?.[0] || item.product.images[0]}
                          alt={item.product.name}
                          fill
                          className="object-cover"
                          sizes="80px"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center text-gray-400 text-xs">
                          {t('noImage')}
                        </div>
                      )}
                    </Link>

                    <div className="flex-1">
                      <Link
                        href={`/${locale}/product/${item.product.id}`}
                        className="text-sm font-semibold text-black-700 hover:text-black-700 transition-colors"
                      >
                        {item.product.name}
                      </Link>
                      <p className="text-xs text-gray-600 mt-1">{item.product.brand}</p>
                      <p className="text-xs text-gray-600 mt-1">
                        Size: {item.variant.size} • Color: {item.variant.color}
                      </p>
                      <p className="text-sm text-gray-600 mt-1">Quantity: {item.quantity}</p>
                    </div>

                    <div className="text-right">
                      <p className="text-sm font-bold text-black-700">
                        Rs {(item.priceAtPurchase * item.quantity).toFixed(2)}
                      </p>
                      <p className="text-xs text-gray-500">
                        Rs {item.priceAtPurchase.toFixed(2)} {t('each')}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Shipping Address */}
            <div className="rounded-lg bg-white p-6 shadow-sm">
              <h2 className="text-lg font-bold text-black-700 mb-4">{t('shippingAddress')}</h2>
              <div className="text-sm text-gray-600 space-y-1">
                <p className="font-medium text-black-700">{order.shippingAddress.fullName}</p>
                <p>{order.shippingAddress.addressLine1}</p>
                {order.shippingAddress.addressLine2 && (
                  <p>{order.shippingAddress.addressLine2}</p>
                )}
                <p>
                  {order.shippingAddress.city}, {order.shippingAddress.state}{' '}
                  {order.shippingAddress.postalCode}
                </p>
                <p>{order.shippingAddress.country}</p>
                <p className="pt-2">{t('phone')} {order.shippingAddress.phone}</p>
              </div>
            </div>
          </div>

          {/* Order Summary */}
          <div className="lg:col-span-1">
            <div className="rounded-lg bg-white p-6 shadow-sm sticky top-4">
              <h2 className="text-lg font-bold text-black-700 mb-4">{t('orderSummary')}</h2>
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">{t('subtotal')}</span>
                  <span className="font-medium text-black-700">Rs {subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">{t('shipping')}</span>
                  <span
                    className={`font-medium ${
                      shipping === 0 ? 'text-green-600' : 'text-black-700'
                    }`}
                  >
                    {shipping === 0 ? t('free') : `$Rs {shipping.toFixed(2)}`}
                  </span>
                </div>
                <div className="flex justify-between border-t border-gray-200 pt-3">
                  <span className="text-base font-bold text-black-700">{t('total')}</span>
                  <span className="text-2xl font-bold text-black-700">
                    Rs {order.totalAmount.toFixed(2)}
                  </span>
                </div>
              </div>

              <div className="mt-6 space-y-3">
                <Link href={`/${locale}/orders`} className="btn-primary w-full text-center block">
                  {t('viewMyOrders')}
                </Link>
                <Link href={`/${locale}/shop`} className="btn-secondary w-full text-center block">
                  {t('continueShopping')}
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
