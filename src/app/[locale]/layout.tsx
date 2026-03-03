import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { cookies } from 'next/headers'
import { NextIntlClientProvider } from 'next-intl'
import { getMessages } from 'next-intl/server'
import { notFound } from 'next/navigation'
import '../globals.css'
import Navigation from '@/components/layout/Navigation'
import { verifyToken } from '@/lib/auth'
import { locales, type Locale } from '@/i18n/request'
import { shopConfig } from '@/config/shop'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

export const metadata: Metadata = {
  title: `${shopConfig.name} - ${shopConfig.tagline}`,
  description: `Shop premium branded clothing at wholesale stock prices. Modern fashion at unbeatable value.`,
  keywords: ['clothing', 'fashion', 'stock price', 'wholesale', 'branded apparel'],
  icons: {
    icon: '/favicon.svg',
  },
}

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }))
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params

  // Validate that the incoming `locale` parameter is valid
  if (!locales.includes(locale as Locale)) {
    notFound()
  }

  // Get messages for the locale
  const messages = await getMessages()

  // Check authentication
  const cookieStore = await cookies()
  const token = cookieStore.get('auth_token')
  let isAuthenticated = false
  let userEmail: string | undefined
  let isAdmin = false

  if (token) {
    try {
      const payload = await verifyToken(token.value)
      if (payload) {
        isAuthenticated = true
        userEmail = payload.email
        isAdmin = payload.role === 'ADMIN'
      }
    } catch {
      // Token is invalid
      isAuthenticated = false
    }
  }

  return (
    <html lang={locale} className={inter.variable}>
      <body className="min-h-screen bg-gray-50">
        <NextIntlClientProvider messages={messages}>
          <Navigation isAuthenticated={isAuthenticated} userEmail={userEmail} isAdmin={isAdmin} />
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  )
}
