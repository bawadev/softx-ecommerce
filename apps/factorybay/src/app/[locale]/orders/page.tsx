import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { getTranslations, getLocale } from 'next-intl/server'
import { verifyToken } from '@/lib/auth'
import { getUserOrdersAction } from '@/app/actions/order'
import OrdersPageClient from './OrdersPageClient'

export default async function OrdersPage() {
  const t = await getTranslations('order.list')
  // LKD-28: locale-aware guard — a bare /login 404s under the middleware
  // matcher (same class LKD-12 fixed on the admin pages).
  const locale = await getLocale()

  // Check authentication
  const cookieStore = await cookies()
  const token = cookieStore.get('auth_token')

  if (!token) {
    redirect(`/${locale}/login?redirect=/${locale}/orders`)
  }

  try {
    await verifyToken(token.value)
  } catch {
    redirect(`/${locale}/login?redirect=/${locale}/orders`)
  }

  // Get orders
  const result = await getUserOrdersAction()

  if (!result.success || !result.data) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <h1 className="text-3xl font-bold text-black-700">{t('title')}</h1>
          <div className="mt-8 text-center">
            <p className="text-gray-600">{result.message || 'Failed to load orders'}</p>
          </div>
        </div>
      </div>
    )
  }

  return <OrdersPageClient orders={result.data.orders} count={result.data.count} />
}
