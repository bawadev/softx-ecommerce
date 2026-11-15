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

  // LKD-44: checkout requires an account. The page used to advertise "no
  // account needed" guest checkout while Place Order popped "Sign In
  // Required" — dishonest UX. Gate here server-side (parity with the orders
  // list guard) so guests get the login form with a return path, and the
  // client never renders the guest-copy flow.
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

  if (!userEmail) {
    redirect(`/${locale}/login?redirect=/${locale}/checkout`)
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
