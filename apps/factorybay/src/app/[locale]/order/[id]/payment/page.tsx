import { notFound, redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { verifyToken } from '@/lib/auth'
import { getOrderById } from '@/lib/repositories/order.repository'
import { getTranslations } from 'next-intl/server'
import PaymentPageClient from './PaymentPageClient'

export default async function PaymentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: orderId } = await params
  const t = await getTranslations('payment')

  // Get current user
  const cookieStore = await cookies()
  const token = cookieStore.get('auth_token')

  if (!token) {
    redirect(`/login?redirect=/order/${orderId}/payment`)
  }

  let userId: string
  try {
    const payload = await verifyToken(token.value)
    if (!payload) {
      redirect(`/login?redirect=/order/${orderId}/payment`)
    }
    userId = payload.userId
  } catch {
    redirect(`/login?redirect=/order/${orderId}/payment`)
  }

  // Get order
  const order = await getOrderById(orderId)

  if (!order) {
    notFound()
  }

  // Verify order belongs to user
  if (order.userId !== userId) {
    notFound()
  }

  // Only allow payment for CONFIRMED orders
  if (order.status !== 'CONFIRMED') {
    redirect(`/order/${orderId}`)
  }

  return <PaymentPageClient order={order} />
}
