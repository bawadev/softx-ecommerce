'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { useEffect, useState, useRef } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import { logoutAction } from '@/app/actions/auth'
import LanguageSwitcher from '@/components/LanguageSwitcher'
import { shopConfig } from '@/config/shop'
import { useCartStore } from '@/stores/cartStore'

interface NavigationProps {
  isAuthenticated: boolean
  userEmail?: string
  isAdmin?: boolean
}

export default function Navigation({ isAuthenticated, userEmail, isAdmin }: NavigationProps) {
  const locale = useLocale()
  const pathname = usePathname()
  const { itemCount, loadCart } = useCartStore()
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [isProfileDropdownOpen, setIsProfileDropdownOpen] = useState(false)
  const profileDropdownRef = useRef<HTMLDivElement>(null)
  const t = useTranslations('nav')
  const tCommon = useTranslations('common')

  // Load cart on mount
  useEffect(() => {
    loadCart()
  }, [])

  // Close mobile menu when pathname changes
  useEffect(() => {
    setIsMobileMenuOpen(false)
  }, [pathname])

  // Prevent body scroll when mobile menu is open
  useEffect(() => {
    if (isMobileMenuOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }
    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [isMobileMenuOpen])

  // Close profile dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (profileDropdownRef.current && !profileDropdownRef.current.contains(event.target as Node)) {
        setIsProfileDropdownOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  // Close dropdown when pathname changes
  useEffect(() => {
    setIsProfileDropdownOpen(false)
  }, [pathname])

  const handleLogout = async () => {
    setIsLoggingOut(true)
    await logoutAction()
    // Reload cart after logout to clear it
    await loadCart()
    window.location.href = `/${locale}`
  }

  return (
    <>
      {/* Glass Morphism Navbar */}
      <nav className="bg-white/80 backdrop-blur-md border-b border-white/20 sticky top-0 z-50 shadow-lg">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-20 items-center justify-between">
            {/* Enhanced Logo */}
            <Link href={`/${locale}`} className="flex items-center gap-3 group">
              <div className="relative">
                <div className="relative flex items-center justify-center group-hover:scale-105 transition-transform duration-300">
                  <Image
                    src="/favicon.png"
                    alt={`${shopConfig.name} Logo`}
                    width={80}
                    height={80}
                    className="object-contain"
                  />
                </div>
              </div>
            </Link>

            {/* Desktop Navigation Links */}
            <div className="hidden md:flex items-center gap-6">
              <LanguageSwitcher />

              {/* Cart Icon */}
              <Link
                href={`/${locale}/cart`}
                className={`group relative p-2.5 rounded-none transition-all duration-200 ${
                  pathname.includes('/cart')
                    ? 'bg-black-700/10 text-black-700 backdrop-blur-sm'
                    : 'text-gray-700 hover:bg-gray-50/50 hover:text-black-700 hover:backdrop-blur-sm'
                }`}
              >
                <div className="relative">
                  <svg
                    className="h-6 w-6"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"
                    />
                  </svg>
                  {itemCount > 0 && (
                    <span className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-black-800 text-xs font-bold text-white shadow-lg animate-pulse">
                      {itemCount > 9 ? '9+' : itemCount}
                    </span>
                  )}
                </div>
              </Link>

              {isAuthenticated ? (
                /* Profile Dropdown */
                <div className="relative" ref={profileDropdownRef}>
                  <button
                    onClick={() => setIsProfileDropdownOpen(!isProfileDropdownOpen)}
                    className={`p-2.5 rounded-lg transition-all duration-200 flex items-center gap-1 ${
                      isProfileDropdownOpen
                        ? 'bg-black-700/10 text-black-700 backdrop-blur-sm'
                        : 'text-gray-700 hover:bg-gray-50/50 hover:text-black-700 hover:backdrop-blur-sm'
                    }`}
                    aria-label="Profile menu"
                  >
                    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                    <svg
                      className={`h-4 w-4 transition-transform duration-200 ${isProfileDropdownOpen ? 'rotate-180' : ''}`}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>

                  {/* Dropdown Menu */}
                  {isProfileDropdownOpen && (
                    <div className="absolute right-0 mt-2 w-56 bg-white/95 backdrop-blur-xl rounded-lg shadow-xl border border-gray-200/50 py-2 z-50">
                      {/* Admin Link */}
                      {isAdmin && (
                        <Link
                          href={`/${locale}/admin/dashboard`}
                          className={`flex items-center gap-3 px-4 py-3 text-sm font-medium transition-all duration-200 ${
                            pathname.includes('/admin')
                              ? 'bg-black-700/10 text-black-700'
                              : 'text-gray-700 hover:bg-gray-50/50 hover:text-black-700'
                          }`}
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
                          {t('adminPanel')}
                        </Link>
                      )}

                      {/* Profile Link */}
                      <Link
                        href={`/${locale}/profile`}
                        className={`flex items-center gap-3 px-4 py-3 text-sm font-medium transition-all duration-200 ${
                          pathname.includes('/profile')
                            ? 'bg-black-700/10 text-black-700'
                            : 'text-gray-700 hover:bg-gray-50/50 hover:text-black-700'
                        }`}
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                        {t('profile')}
                      </Link>

                      {/* Divider */}
                      <div className="my-2 border-t border-gray-200/50" />

                      {/* Logout Button */}
                      <button
                        onClick={handleLogout}
                        disabled={isLoggingOut}
                        className="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium text-red-600 hover:bg-red-50/50 transition-all duration-200 disabled:opacity-50"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                        </svg>
                        {isLoggingOut ? tCommon('loggingOut') : tCommon('logout')}
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <Link
                  href={`/${locale}/auth`}
                  className="px-4 py-2 rounded-none text-sm font-medium text-gray-700 hover:bg-gray-50/50 hover:text-black-700 hover:backdrop-blur-sm transition-all duration-200"
                >
                  Sign in / Sign up
                </Link>
              )}
            </div>

            {/* Mobile: Cart + Hamburger */}
            <div className="flex md:hidden items-center gap-3">
              {/* Cart Icon */}
              <Link
                href={`/${locale}/cart`}
                className="group relative p-2 rounded-none transition-all duration-200 text-gray-700 hover:bg-gray-50/50 hover:text-black-700 hover:backdrop-blur-sm"
              >
                <div className="relative">
                  <svg
                    className="h-6 w-6"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"
                    />
                  </svg>
                  {itemCount > 0 && (
                    <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-black-800 text-xs font-bold text-white shadow-lg">
                      {itemCount > 9 ? '9+' : itemCount}
                    </span>
                  )}
                </div>
              </Link>

              {/* Hamburger Menu Button */}
              <button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="p-2 rounded-none text-gray-700 hover:bg-gray-50/50 hover:text-black-700 hover:backdrop-blur-sm transition-all duration-200"
                aria-label="Toggle menu"
              >
                {isMobileMenuOpen ? (
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                ) : (
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                )}
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Mobile Menu Overlay - Enhanced Glass Effect */}
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 z-40 bg-gray-900/30 backdrop-blur-md md:hidden transition-all duration-300"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Mobile Menu Drawer - Glass Theme */}
      <div
        className={`fixed top-0 right-0 bottom-0 z-50 w-80 max-w-[85vw] bg-white/95 backdrop-blur-xl shadow-2xl md:hidden transform transition-all duration-500 ease-out border-l border-white/20 ${
          isMobileMenuOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="flex flex-col h-full">
          {/* Mobile Menu Header - Glass Style */}
          <div className="flex items-center justify-between px-6 py-5 border-b border-gray-200/50 backdrop-blur-sm bg-gray-50">
            <div className="flex items-center gap-2">
              <div className="flex items-center justify-center">
                <Image
                  src="/favicon.png"
                  alt={`${shopConfig.name} Logo`}
                  width={40}
                  height={40}
                  className="object-contain"
                />
              </div>
              <span className="text-lg font-bold text-black-700">{t('menu')}</span>
            </div>
            <button
              onClick={() => setIsMobileMenuOpen(false)}
              className="p-2 rounded-none text-gray-500 hover:text-gray-700 hover:bg-gray-100/50 transition-all duration-200"
              aria-label="Close menu"
            >
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Mobile Menu Content */}
          <div className="flex-1 overflow-y-auto px-6 py-6">
            <nav className="space-y-1">
              {/* Language Switcher */}
              <div className="pb-4 mb-4 border-b border-gray-200/50">
                <LanguageSwitcher />
              </div>

              {/* Admin Dashboard Link (Mobile) */}
              {isAdmin && (
                <Link
                  href={`/${locale}/admin/dashboard`}
                  className="block px-4 py-3.5 rounded-none text-base font-semibold text-center bg-black-700 text-white shadow-lg hover:shadow-lg transition-all duration-200"
                >
                  <span className="flex items-center justify-center gap-2">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    {t('adminPanel')}
                  </span>
                </Link>
              )}

              {isAuthenticated ? (
                <>
                  {/* Profile Link */}
                  <Link
                    href={`/${locale}/profile`}
                    className={`block px-4 py-3.5 rounded-none text-base font-medium transition-all duration-200 ${
                      pathname.includes('/profile')
                        ? 'bg-black-700/10 text-black-700 backdrop-blur-sm shadow-sm'
                        : 'text-gray-700 hover:bg-gray-50/50 hover:backdrop-blur-sm'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                      {t('profile')}
                    </div>
                  </Link>

                  {/* Logout Button */}
                  <button
                    onClick={handleLogout}
                    disabled={isLoggingOut}
                    className="w-full px-4 py-3.5 rounded-none text-base font-medium text-red-600 hover:bg-red-50/50 hover:backdrop-blur-sm transition-all duration-200 disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                    {isLoggingOut ? tCommon('loggingOut') : tCommon('logout')}
                  </button>
                </>
              ) : (
                <>
                  {/* Sign In Button */}
                  <Link
                    href={`/${locale}/auth`}
                    className="block px-4 py-3.5 rounded-none text-base font-medium text-gray-700 hover:bg-gray-50/50 hover:backdrop-blur-sm transition-all duration-200 text-center"
                  >
                    Sign in / Sign up
                  </Link>
                </>
              )}
            </nav>
          </div>
        </div>
      </div>
    </>
  )
}
