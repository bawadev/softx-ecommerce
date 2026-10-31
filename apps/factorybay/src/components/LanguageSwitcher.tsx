'use client'

import { useLocale } from 'next-intl'
import { useRouter, usePathname } from 'next/navigation'
import { locales, type Locale } from '@/i18n/request'

export default function LanguageSwitcher() {
  const locale = useLocale() as Locale
  const router = useRouter()
  const pathname = usePathname()

  const switchLocale = (newLocale: Locale) => {
    // Get the current path without the locale prefix
    const pathWithoutLocale = pathname.replace(`/${locale}`, '')

    // Navigate to the same path with the new locale
    router.push(`/${newLocale}${pathWithoutLocale}`)
  }

  return (
    <div className="flex items-center gap-2 p-1 bg-gray-100/50 backdrop-blur-sm rounded-lg border border-gray-200/50">
      {locales.map((loc) => (
        <button
          key={loc}
          onClick={() => switchLocale(loc)}
          className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all duration-300 ${
            locale === loc
              ? 'bg-black-700 text-white shadow-md scale-105'
              : 'bg-transparent text-gray-600 hover:bg-white/50 hover:text-black-700 hover:backdrop-blur-sm'
          }`}
        >
          {loc === 'en' ? 'EN' : 'සිං'}
        </button>
      ))}
    </div>
  )
}
