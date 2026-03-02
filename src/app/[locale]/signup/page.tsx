'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useTranslations, useLocale } from 'next-intl'
import { signupAction } from '@/app/actions/auth'
import Input from '@/components/ui/Input'
import Button from '@/components/ui/Button'

export default function SignupPage() {
  const router = useRouter()
  const locale = useLocale()
  const t = useTranslations('auth.signup')
  const tCommon = useTranslations('common')
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    firstName: '',
    lastName: '',
    phone: '',
  })
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setIsLoading(true)

    try {
      const result = await signupAction(formData)

      if (result.success) {
        // Use full page reload to ensure layout picks up new auth cookie
        window.location.href = `/${locale}/shop`
      } else {
        setError(result.message || 'Signup failed')
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
          <h1 className="text-4xl font-bold text-black-900 mb-2">{tCommon('appName')}</h1>
          <p className="text-gray-600">{t('subtitle')}</p>
        </div>

        {/* Signup Form */}
        <div className="card p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">
            {t('title')}
          </h2>

          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <Input
                id="firstName"
                type="text"
                label={t('firstName')}
                placeholder="John"
                value={formData.firstName}
                onChange={(e) =>
                  setFormData({ ...formData, firstName: e.target.value })
                }
                required
                autoComplete="given-name"
              />

              <Input
                id="lastName"
                type="text"
                label={t('lastName')}
                placeholder="Doe"
                value={formData.lastName}
                onChange={(e) =>
                  setFormData({ ...formData, lastName: e.target.value })
                }
                required
                autoComplete="family-name"
              />
            </div>

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
              id="phone"
              type="tel"
              label="Phone number (optional)"
              placeholder="+1 (555) 123-4567"
              value={formData.phone}
              onChange={(e) =>
                setFormData({ ...formData, phone: e.target.value })
              }
              autoComplete="tel"
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
              autoComplete="new-password"
              showPasswordToggle
              hint="Min 8 characters, 1 uppercase, 1 number"
            />

            <Button type="submit" className="w-full" isLoading={isLoading}>
              {isLoading ? t('creating') : t('submit')}
            </Button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-sm text-gray-600">
              {t('hasAccount')}{' '}
              <Link
                href={`/${locale}/login`}
                className="font-semibold text-black-700 hover:text-black-800 transition-colors"
              >
                {t('signIn')}
              </Link>
            </p>
          </div>
        </div>

        {/* Additional Info */}
        <div className="mt-6 text-center text-sm text-gray-500">
          <p>By signing up, you agree to our Terms and Privacy Policy</p>
        </div>
      </div>
    </div>
  )
}
