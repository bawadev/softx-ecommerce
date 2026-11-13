import Link from 'next/link'
import { getTranslations } from 'next-intl/server'

// LKD-33: unknown product/route ids used to fall through to Next.js's bare
// default 404 (no header, no way back). Inside [locale] this page renders
// under the locale layout, so the site header/navigation comes with it.
export default async function NotFound() {
  const t = await getTranslations('common')

  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center text-center px-4">
      <p className="font-display text-display-lg uppercase text-black-700">404</p>
      <h1 className="mt-2 text-xl font-semibold text-black-700">
        {t('notFoundTitle')}
      </h1>
      <p className="mt-2 text-gray-600">{t('notFoundMessage')}</p>
      <Link href="/" className="btn-primary mt-8 inline-block">
        {t('notFoundBackToShop')}
      </Link>
    </div>
  )
}
