'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useTranslations, useLocale } from 'next-intl'
import type { OrderWithItems } from '@/lib/repositories/order.repository'

interface OrdersPageClientProps {
  orders: OrderWithItems[]
  count: number
}

export default function OrdersPageClient({ orders, count }: OrdersPageClientProps) {
  const locale = useLocale()
  const t = useTranslations('order.list')
  const tStatus = useTranslations('order.status')

  if (orders.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="bg-white border-b border-gray-200">
          <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
            <h1 className="text-3xl font-bold text-black-700">{t('title')}</h1>
            <p className="mt-2 text-gray-600">{t('subtitle')}</p>
          </div>
        </div>

        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
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
                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
              />
            </svg>
            <h2 className="mt-6 text-xl font-semibold text-black-700">{t('noOrders')}</h2>
            <p className="mt-2 text-gray-600">{t('noOrdersMessage')}</p>
            <Link href={`/${locale}/shop`} className="btn-primary mt-8 inline-block">
              {t('startShopping')}
            </Link>
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
          <h1 className="text-3xl font-bold text-black-700">{t('title')}</h1>
          <p className="mt-2 text-gray-600">{t('ordersPlaced', { count })}</p>
        </div>
      </div>

      {/* Orders List */}
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="space-y-6">
          {orders.map((order) => {
            const orderDate = new Date(order.createdAt).toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'short',
              day: 'numeric',
            })

            return (
              <div key={order.id} className="rounded-lg bg-white shadow-sm">
                {/* Order Header */}
                <div className="border-b border-gray-200 px-6 py-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-8">
                      <div>
                        <p className="text-xs text-gray-600">{t('orderNumber')}</p>
                        <p className="font-semibold text-black-700">{order.orderNumber}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-600">{t('date')}</p>
                        <p className="text-sm text-black-700">{orderDate}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-600">{t('total')}</p>
                        <p className="text-sm font-semibold text-black-700">
                          Rs {order.totalAmount.toFixed(2)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <span
                        className={`inline-block rounded-full px-3 py-1 text-xs font-semibold ${
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
                      <Link
                        href={`/${locale}/order/${order.id}`}
                        className="text-sm font-medium text-black-700 hover:text-black-700"
                      >
                        {t('viewDetails')}
                      </Link>
                    </div>
                  </div>
                </div>

                {/* Order Items */}
                <div className="px-6 py-4">
                  <div className="space-y-4">
                    {order.items.map((item) => (
                      <div key={item.id} className="flex gap-4">
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
                            {t('size')} {item.variant.size} • {t('color')} {item.variant.color} • {t('qty')}{' '}
                            {item.quantity}
                          </p>
                        </div>

                        <div className="text-right">
                          <p className="text-sm font-bold text-black-700">
                            Rs {(item.priceAtPurchase * item.quantity).toFixed(2)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
