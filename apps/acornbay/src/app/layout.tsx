import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import Link from 'next/link'
import './globals.css'

export const metadata: Metadata = {
  title: { default: 'Storefront', template: '%s — Storefront' },
  description:
    'Minimal contract-only storefront: a server-rendered consumer of @softx/contract v1 through @softx/engine.',
}

export default function RootLayout({ children }: { children: ReactNode }) {
  const brand = process.env.CLIENT_ID || 'store-template'
  return (
    <html lang="en">
      <body>
        <header className="site-header">
          <div className="site-header-inner">
            <Link href="/" className="wordmark">
              {brand}
              <span className="wordmark-dot">.</span>
            </Link>
            <nav className="site-nav" aria-label="Primary">
              <Link href="/">Home</Link>
              <Link href="/shop">Shop</Link>
            </nav>
          </div>
        </header>
        <main className="site-main">{children}</main>
        <footer className="site-footer">
          <div className="site-footer-inner">
            <span>
              {brand} — catalog-only pilot (no cart / auth in the template).
            </span>
            <span className="muted">
              Powered by <code>@softx/contract</code> v1 via <code>@softx/engine</code>.
            </span>
          </div>
        </footer>
      </body>
    </html>
  )
}
