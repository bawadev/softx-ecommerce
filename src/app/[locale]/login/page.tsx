'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useTranslations, useLocale } from 'next-intl'
import { loginAction } from '@/app/actions/auth'
import Input from '@/components/ui/Input'
import Button from '@/components/ui/Button'

export default function LoginPage() {
  const router = useRouter()
  const locale = useLocale()
  const t = useTranslations('auth.login')
  const tCommon = useTranslations('common')
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  })
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setIsLoading(true)

    try {
      const result = await loginAction(formData)

      if (result.success) {
        // Use full page reload to ensure layout picks up new auth cookie
        if (result.user?.role === 'ADMIN') {
          window.location.href = `/${locale}/admin/dashboard`
        } else {
          window.location.href = `/${locale}/shop`
        }
      } else {
        setError(result.message || 'Login failed')
      }
    } catch (err) {
      setError('An unexpected error occurred')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo/Brand */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-black-700 mb-2">{tCommon('appName')}</h1>
          <p className="text-gray-600">{t('subtitle')}</p>
        </div>

        {/* Login Form */}
        <div className="card p-8">
          <h2 className="text-2xl font-bold text-black-700 mb-6">
            {t('title')}
          </h2>

          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <Input
              id="email"
              type="email"
              label={t('email')}
              placeholder="you@example.com"
              value={formData.email}
              onChange={(e) =>
                setFormData({ ...formData, email: e.target.value })
              }
              required
              autoComplete="email"
            />

            <Input
              id="password"
              type="password"
              label={t('password')}
              placeholder="••••••••"
              value={formData.password}
              onChange={(e) =>
                setFormData({ ...formData, password: e.target.value })
              }
              required
              autoComplete="current-password"
              showPasswordToggle
            />

            <Button type="submit" className="w-full" isLoading={isLoading}>
              {isLoading ? t('signingIn') : t('submit')}
            </Button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-sm text-gray-600">
              {t('noAccount')}{' '}
              <Link
                href={`/${locale}/signup`}
                className="font-semibold text-black-700 hover:text-black-700 transition-colors"
              >
                {t('signUp')}
              </Link>
            </p>
          </div>
        </div>

        {/* Additional Info */}
        <div className="mt-6 text-center text-sm text-gray-500">
          <p>{tCommon('tagline')}</p>
        </div>
      </div>
    </div>
  )
}
