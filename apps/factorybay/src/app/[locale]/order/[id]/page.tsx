import { notFound, redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { verifyToken } from '@/lib/auth'
import { getOrderAction } from '@/app/actions/order'
import OrderConfirmationClient from './OrderConfirmationClient'

export default async function OrderConfirmationPage({
  params,
}: {
  params: Promise<{ id: string; locale: string }>
}) {
  const { id, locale } = await params

  // Check authentication
  const cookieStore = await cookies()
  const token = cookieStore.get('auth_token')

  if (!token) {
    // LKD-48: honor the return path like every other guard (orders list,
    // payment page) instead of dropping the visitor on a bare login form.
    redirect(`/${locale}/login?redirect=/${locale}/order/${id}`)
  }

  try {
    await verifyToken(token.value)
  } catch {
    redirect(`/${locale}/login?redirect=/${locale}/order/${id}`)
  }

  // Get order
  const result = await getOrderAction(id)

  if (!result.success || !result.data) {
    notFound()
  }

  return <OrderConfirmationClient order={result.data.order} />
}
