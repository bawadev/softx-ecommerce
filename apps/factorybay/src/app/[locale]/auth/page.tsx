'use client'

import { useState } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import { loginAction, signupAction } from '@/app/actions/auth'
import { shopConfig } from '@/config/shop'
import Input from '@/components/ui/Input'
import Button from '@/components/ui/Button'
import Tabs, { Tab } from '@/components/ui/Tabs'

export default function AuthPage() {
  const locale = useLocale()
  const tLogin = useTranslations('auth.login')
  const tSignup = useTranslations('auth.signup')
  const tCommon = useTranslations('common')

  const [activeTab, setActiveTab] = useState('signin')

  // Login form state
  const [loginData, setLoginData] = useState({
    email: '',
    password: '',
  })
  const [loginError, setLoginError] = useState('')
  const [isLoginLoading, setIsLoginLoading] = useState(false)

  // Signup form state
  const [signupData, setSignupData] = useState({
    email: '',
    password: '',
    firstName: '',
    lastName: '',
    phone: '',
  })
  const [signupError, setSignupError] = useState('')
  const [isSignupLoading, setIsSignupLoading] = useState(false)

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoginError('')
    setIsLoginLoading(true)

    try {
      const result = await loginAction(loginData)

      if (result.success) {
        if (result.user?.role === 'ADMIN') {
          window.location.href = `/${locale}/admin/dashboard`
        } else {
          window.location.href = `/${locale}/shop`
        }
      } else {
        setLoginError(result.message || 'Login failed')
      }
    } catch (err) {
      setLoginError('An unexpected error occurred')
    } finally {
      setIsLoginLoading(false)
    }
  }

  const handleSignupSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSignupError('')
    setIsSignupLoading(true)

    try {
      const result = await signupAction(signupData)

      if (result.success) {
        window.location.href = `/${locale}/shop`
      } else {
        setSignupError(result.message || 'Signup failed')
      }
    } catch (err) {
      setSignupError('An unexpected error occurred')
    } finally {
      setIsSignupLoading(false)
    }
  }

  const tabs: Tab[] = [
    {
      id: 'signin',
      label: tLogin('title'),
      content: (
        <form onSubmit={handleLoginSubmit} className="space-y-5">
          {loginError && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-none text-red-700 text-sm">
              {loginError}
            </div>
          )}

          <Input
            id="email"
            type="email"
            label={tLogin('email')}
            placeholder="you@example.com"
            value={loginData.email}
            onChange={(e) =>
              setLoginData({ ...loginData, email: e.target.value })
            }
            required
            autoComplete="email"
          />

          <Input
            id="password"
            type="password"
            label={tLogin('password')}
            placeholder="••••••••"
            value={loginData.password}
            onChange={(e) =>
              setLoginData({ ...loginData, password: e.target.value })
            }
            required
            autoComplete="current-password"
            showPasswordToggle
          />

          <Button type="submit" className="w-full" isLoading={isLoginLoading} variant="primary">
            {isLoginLoading ? tLogin('signingIn') : tLogin('submit')}
          </Button>
        </form>
      ),
    },
    {
      id: 'signup',
      label: tSignup('title'),
      content: (
        <form onSubmit={handleSignupSubmit} className="space-y-5">
          {signupError && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-none text-red-700 text-sm">
              {signupError}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <Input
              id="firstName"
              type="text"
              label={tSignup('firstName')}
              placeholder="John"
              value={signupData.firstName}
              onChange={(e) =>
                setSignupData({ ...signupData, firstName: e.target.value })
              }
              required
              autoComplete="given-name"
            />

            <Input
              id="lastName"
              type="text"
              label={tSignup('lastName')}
              placeholder="Doe"
              value={signupData.lastName}
              onChange={(e) =>
                setSignupData({ ...signupData, lastName: e.target.value })
              }
              required
              autoComplete="family-name"
            />
          </div>

          <Input
            id="email"
            type="email"
            label={tSignup('email')}
            placeholder="you@example.com"
            value={signupData.email}
            onChange={(e) =>
              setSignupData({ ...signupData, email: e.target.value })
            }
            required
            autoComplete="email"
          />

          <Input
            id="phone"
            type="tel"
            label="Phone number (optional)"
            placeholder="+1 (555) 123-4567"
            value={signupData.phone}
            onChange={(e) =>
              setSignupData({ ...signupData, phone: e.target.value })
            }
            autoComplete="tel"
          />

          <Input
            id="password"
            type="password"
            label={tSignup('password')}
            placeholder="••••••••"
            value={signupData.password}
            onChange={(e) =>
              setSignupData({ ...signupData, password: e.target.value })
            }
            required
            autoComplete="new-password"
            showPasswordToggle
            hint="Min 8 characters, 1 uppercase, 1 number"
          />

          <Button type="submit" className="w-full" isLoading={isSignupLoading} variant="primary">
            {isSignupLoading ? tSignup('creating') : tSignup('submit')}
          </Button>

          <div className="mt-4 text-center text-xs text-gray-500">
            By signing up, you agree to our Terms and Privacy Policy
          </div>
        </form>
      ),
    },
  ]

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo/Brand */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-black-700 mb-2">{shopConfig.name}</h1>
          <p className="text-gray-600">
            {activeTab === 'signin' ? tLogin('subtitle') : tSignup('subtitle')}
          </p>
        </div>

        {/* Auth Card with Tabs */}
        <div className="card p-8">
          <Tabs tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab} />
        </div>

        {/* Additional Info */}
        <div className="mt-6 text-center text-sm text-gray-500">
          <p>{shopConfig.tagline}</p>
        </div>
      </div>
    </div>
  )
}
