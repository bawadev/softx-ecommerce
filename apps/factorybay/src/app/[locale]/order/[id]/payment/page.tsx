import { notFound, redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { verifyToken } from '@/lib/auth'
import { getOrderService } from '@/lib/engine'
import { getTranslations, getLocale } from 'next-intl/server'
import PaymentPageClient from './PaymentPageClient'

export default async function PaymentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: orderId } = await params
  const t = await getTranslations('payment')
  // LKD-28: locale-aware guard — a bare /login 404s under the middleware
  // matcher (same class LKD-12 fixed on the admin pages).
  const locale = await getLocale()

  // Get current user
  const cookieStore = await cookies()
  const token = cookieStore.get('auth_token')

  if (!token) {
    redirect(`/${locale}/login?redirect=/${locale}/order/${orderId}/payment`)
  }

  let userId: string
  try {
    const payload = await verifyToken(token.value)
    if (!payload) {
      redirect(`/${locale}/login?redirect=/${locale}/order/${orderId}/payment`)
    }
    userId = payload.userId
  } catch {
    redirect(`/${locale}/login?redirect=/${locale}/order/${orderId}/payment`)
  }

  // Get order through the service (enforces ownership; NOT_FOUND/UNAUTHORIZED
  // both render as 404 here, matching the previous behavior)
  const r = await getOrderService().getOrder(userId, orderId)

  if (!r.ok) {
    notFound()
  }

  // Only allow payment for CONFIRMED orders
  if (r.data.status !== 'CONFIRMED') {
    redirect(`/${locale}/order/${orderId}`)
  }

  return <PaymentPageClient order={r.data} />
}
