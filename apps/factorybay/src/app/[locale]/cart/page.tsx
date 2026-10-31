import Link from 'next/link'
import { getTranslations, getLocale } from 'next-intl/server'
import { getCartItemsAction } from '@/app/actions/cart'
import CartPageClient from './CartPageClient'

export default async function CartPage() {
  const t = await getTranslations('cart')
  const locale = await getLocale()

  // Get cart items (works for both authenticated and guest users)
  const result = await getCartItemsAction()

  if (!result.success || !result.data) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <h1 className="text-3xl font-bold text-black-700">{t('title')}</h1>
          <div className="mt-8 text-center">
            <p className="text-gray-600">{result.message || t('failedToLoad')}</p>
          </div>
        </div>
      </div>
    )
  }

  const { items, total, itemCount } = result.data

  // Empty cart state
  if (items.length === 0) {
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

  return <CartPageClient initialItems={items} initialTotal={total} initialItemCount={itemCount} />
}
