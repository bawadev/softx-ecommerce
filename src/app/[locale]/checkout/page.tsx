import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { verifyToken } from '@/lib/auth'
import { getCartItemsAction } from '@/app/actions/cart'
import CheckoutPageClient from './CheckoutPageClient'

export default async function CheckoutPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params

  // Get cart items (works for both authenticated and guest users)
  const result = await getCartItemsAction()

  if (!result.success || !result.data || result.data.items.length === 0) {
    redirect(`/${locale}/cart`)
  }

  const { items, total, itemCount } = result.data

  // Check if user is authenticated (optional for checkout)
  const cookieStore = await cookies()
  const token = cookieStore.get('auth_token')
  let userEmail: string | undefined

  if (token) {
    try {
      const payload = await verifyToken(token.value)
      if (payload) {
        userEmail = payload.email
      }
    } catch {
      // Invalid token, treat as guest
      userEmail = undefined
    }
  }

  return (
    <CheckoutPageClient
      items={items}
      total={total}
      itemCount={itemCount}
      userEmail={userEmail}
      isAuthenticated={!!userEmail}
    />
  )
}
