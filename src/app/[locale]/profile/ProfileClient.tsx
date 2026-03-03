'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { updateUserPreferencesAction, updateUserMeasurementsAction } from '@/app/actions/user-profile'
import type { User, UserPreference, UserMeasurements, ProductCategory, SizeOption, MeasurementUnit } from '@/lib/types'

interface ProfileClientProps {
  user: User
  initialPreferences: UserPreference | null
  initialMeasurements: UserMeasurements | null
}

export default function ProfileClient({
  user,
  initialPreferences,
  initialMeasurements,
}: ProfileClientProps) {
  const t = useTranslations('profile')
  const tCommon = useTranslations('common')
  const tCategories = useTranslations('categories')
  const tSizes = useTranslations('sizes')

  const [activeTab, setActiveTab] = useState<'info' | 'preferences' | 'measurements'>('info')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  // Preferences state
  const [preferredBrands, setPreferredBrands] = useState<string[]>(initialPreferences?.preferredBrands || [])
  const [preferredColors, setPreferredColors] = useState<string[]>(initialPreferences?.preferredColors || [])
  const [preferredCategories, setPreferredCategories] = useState<ProductCategory[]>(initialPreferences?.preferredCategories || [])
  const [priceMin, setPriceMin] = useState(initialPreferences?.priceRange?.min?.toString() || '0')
  const [priceMax, setPriceMax] = useState(initialPreferences?.priceRange?.max?.toString() || '500')
  const [brandInput, setBrandInput] = useState('')
  const [colorInput, setColorInput] = useState('')

  // Measurements state
  const [chest, setChest] = useState(initialMeasurements?.chest?.toString() || '')
  const [waist, setWaist] = useState(initialMeasurements?.waist?.toString() || '')
  const [hips, setHips] = useState(initialMeasurements?.hips?.toString() || '')
  const [shoulders, setShoulders] = useState(initialMeasurements?.shoulders?.toString() || '')
  const [inseam, setInseam] = useState(initialMeasurements?.inseam?.toString() || '')
  const [height, setHeight] = useState(initialMeasurements?.height?.toString() || '')
  const [weight, setWeight] = useState(initialMeasurements?.weight?.toString() || '')
  const [preferredSize, setPreferredSize] = useState<SizeOption | ''>(initialMeasurements?.preferredSize || '')
  const [unit, setUnit] = useState<MeasurementUnit>(initialMeasurements?.unit || 'METRIC')

  const categories: ProductCategory[] = ['SHIRT', 'PANTS', 'JACKET', 'DRESS', 'SHOES', 'ACCESSORIES']
  const sizes: SizeOption[] = ['XS', 'S', 'M', 'L', 'XL', 'XXL']

  const addBrand = () => {
    if (brandInput.trim() && !preferredBrands.includes(brandInput.trim())) {
      setPreferredBrands([...preferredBrands, brandInput.trim()])
      setBrandInput('')
    }
  }

  const removeBrand = (brand: string) => {
    setPreferredBrands(preferredBrands.filter(b => b !== brand))
  }

  const addColor = () => {
    if (colorInput.trim() && !preferredColors.includes(colorInput.trim())) {
      setPreferredColors([...preferredColors, colorInput.trim()])
      setColorInput('')
    }
  }

  const removeColor = (color: string) => {
    setPreferredColors(preferredColors.filter(c => c !== color))
  }

  const toggleCategory = (category: ProductCategory) => {
    if (preferredCategories.includes(category)) {
      setPreferredCategories(preferredCategories.filter(c => c !== category))
    } else {
      setPreferredCategories([...preferredCategories, category])
    }
  }

  const handleSavePreferences = async () => {
    setLoading(true)
    setMessage('')

    try {
      const result = await updateUserPreferencesAction(
        preferredBrands,
        preferredColors,
        preferredCategories,
        {
          min: parseFloat(priceMin) || 0,
          max: parseFloat(priceMax) || 500,
        }
      )

      if (result.success) {
        setMessage(t('preferences.saved'))
      } else {
        setMessage(result.message || 'Failed to save preferences')
      }
    } catch (error) {
      setMessage('An error occurred while saving preferences')
    } finally {
      setLoading(false)
    }
  }

  const handleSaveMeasurements = async () => {
    setLoading(true)
    setMessage('')

    try {
      const result = await updateUserMeasurementsAction({
        chest: chest ? parseFloat(chest) : undefined,
        waist: waist ? parseFloat(waist) : undefined,
        hips: hips ? parseFloat(hips) : undefined,
        shoulders: shoulders ? parseFloat(shoulders) : undefined,
        inseam: inseam ? parseFloat(inseam) : undefined,
        height: height ? parseFloat(height) : undefined,
        weight: weight ? parseFloat(weight) : undefined,
        preferredSize: preferredSize || undefined,
        unit,
      })

      if (result.success) {
        setMessage(t('measurements.saved'))
      } else {
        setMessage(result.message || 'Failed to save measurements')
      }
    } catch (error) {
      setMessage('An error occurred while saving measurements')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-black-700">{t('title')}</h1>
              <p className="mt-1 text-sm text-gray-600">{t('subtitle')}</p>
            </div>
            <Link href="/" className="text-sm text-black-700 hover:text-black-700 font-medium">
              {t('backToHome')}
            </Link>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white border-b border-gray-200">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex gap-8">
            <button
              onClick={() => setActiveTab('info')}
              className={`py-4 border-b-2 font-medium text-sm ${
                activeTab === 'info'
                  ? 'border-black-700 text-black-700'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {t('tabs.accountInfo')}
            </button>
            <button
              onClick={() => setActiveTab('preferences')}
              className={`py-4 border-b-2 font-medium text-sm ${
                activeTab === 'preferences'
                  ? 'border-black-700 text-black-700'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {t('tabs.preferences')}
            </button>
            <button
              onClick={() => setActiveTab('measurements')}
              className={`py-4 border-b-2 font-medium text-sm ${
                activeTab === 'measurements'
                  ? 'border-black-700 text-black-700'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {t('tabs.measurements')}
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        {message && (
          <div className={`mb-6 p-4 rounded ${
            message.includes('success') ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
          }`}>
            {message}
          </div>
        )}

        {/* Account Info Tab */}
        {activeTab === 'info' && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-black-700 mb-4">{t('accountInfo.title')}</h2>
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('accountInfo.firstName')}</label>
                  <input
                    type="text"
                    value={user.firstName}
                    disabled
                    className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('accountInfo.lastName')}</label>
                  <input
                    type="text"
                    value={user.lastName}
                    disabled
                    className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('accountInfo.email')}</label>
                <input
                  type="email"
                  value={user.email}
                  disabled
                  className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-500"
                />
              </div>
              {user.phone && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                  <input
                    type="tel"
                    value={user.phone}
                    disabled
                    className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-500"
                  />
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('accountInfo.role')}</label>
                <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${
                  user.role === 'ADMIN' ? 'bg-gray-100 text-purple-800' : 'bg-gray-100 text-black-700'
                }`}>
                  {user.role}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Preferences Tab */}
        {activeTab === 'preferences' && (
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-black-700 mb-4">{t('preferences.title')}</h2>

              {/* Preferred Brands */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">{t('preferences.brands')}</label>
                <div className="flex gap-2 mb-2">
                  <input
                    type="text"
                    value={brandInput}
                    onChange={(e) => setBrandInput(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addBrand())}
                    placeholder={t('preferences.brandsPlaceholder')}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-black-700 focus:border-transparent"
                  />
                  <button
                    type="button"
                    onClick={addBrand}
                    className="px-4 py-2 bg-black-700 text-white rounded-md hover:bg-black-800"
                  >
                    {tCommon('add')}
                  </button>
                </div>
                {preferredBrands.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {preferredBrands.map((brand) => (
                      <span key={brand} className="inline-flex items-center gap-1 bg-gray-100 px-3 py-1 rounded-full text-sm">
                        {brand}
                        <button
                          onClick={() => removeBrand(brand)}
                          className="text-gray-600 hover:text-red-600"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Preferred Colors */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">{t('preferences.colors')}</label>
                <div className="flex gap-2 mb-2">
                  <input
                    type="text"
                    value={colorInput}
                    onChange={(e) => setColorInput(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addColor())}
                    placeholder={t('preferences.colorsPlaceholder')}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-black-700 focus:border-transparent"
                  />
                  <button
                    type="button"
                    onClick={addColor}
                    className="px-4 py-2 bg-black-700 text-white rounded-md hover:bg-black-800"
                  >
                    {tCommon('add')}
                  </button>
                </div>
                {preferredColors.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {preferredColors.map((color) => (
                      <span key={color} className="inline-flex items-center gap-1 bg-gray-100 px-3 py-1 rounded-full text-sm">
                        {color}
                        <button
                          onClick={() => removeColor(color)}
                          className="text-gray-600 hover:text-red-600"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Preferred Categories */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">{t('preferences.categories')}</label>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {categories.map((category) => (
                    <button
                      key={category}
                      type="button"
                      onClick={() => toggleCategory(category)}
                      className={`px-4 py-2 rounded-md border-2 text-sm font-medium ${
                        preferredCategories.includes(category)
                          ? 'border-black-700 bg-gray-50 text-black-700'
                          : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400'
                      }`}
                    >
                      {tCategories(category)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Price Range */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">{t('preferences.priceRange')}</label>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">{t('preferences.min')}</label>
                    <input
                      type="number"
                      value={priceMin}
                      onChange={(e) => setPriceMin(e.target.value)}
                      min="0"
                      step="10"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-black-700 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">{t('preferences.max')}</label>
                    <input
                      type="number"
                      value={priceMax}
                      onChange={(e) => setPriceMax(e.target.value)}
                      min="0"
                      step="10"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-black-700 focus:border-transparent"
                    />
                  </div>
                </div>
              </div>

              <button
                onClick={handleSavePreferences}
                disabled={loading}
                className="w-full px-4 py-2 bg-black-700 text-white rounded-md hover:bg-black-800 disabled:opacity-50"
              >
                {loading ? tCommon('loading') : t('preferences.save')}
              </button>
            </div>
          </div>
        )}

        {/* Measurements Tab */}
        {activeTab === 'measurements' && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-black-700 mb-4">{t('measurements.title')}</h2>

            {/* Unit Selection */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">{t('measurements.unit')}</label>
              <div className="flex gap-4">
                <button
                  type="button"
                  onClick={() => setUnit('METRIC')}
                  className={`px-4 py-2 rounded-md border-2 text-sm font-medium ${
                    unit === 'METRIC'
                      ? 'border-black-700 bg-gray-50 text-black-700'
                      : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400'
                  }`}
                >
                  {t('measurements.metric')}
                </button>
                <button
                  type="button"
                  onClick={() => setUnit('IMPERIAL')}
                  className={`px-4 py-2 rounded-md border-2 text-sm font-medium ${
                    unit === 'IMPERIAL'
                      ? 'border-black-700 bg-gray-50 text-black-700'
                      : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400'
                  }`}
                >
                  {t('measurements.imperial')}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 mb-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('measurements.chest')} ({unit === 'METRIC' ? 'cm' : 'in'})
                </label>
                <input
                  type="number"
                  value={chest}
                  onChange={(e) => setChest(e.target.value)}
                  step="0.1"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-black-700 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('measurements.waist')} ({unit === 'METRIC' ? 'cm' : 'in'})
                </label>
                <input
                  type="number"
                  value={waist}
                  onChange={(e) => setWaist(e.target.value)}
                  step="0.1"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-black-700 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('measurements.hips')} ({unit === 'METRIC' ? 'cm' : 'in'})
                </label>
                <input
                  type="number"
                  value={hips}
                  onChange={(e) => setHips(e.target.value)}
                  step="0.1"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-black-700 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('measurements.shoulders')} ({unit === 'METRIC' ? 'cm' : 'in'})
                </label>
                <input
                  type="number"
                  value={shoulders}
                  onChange={(e) => setShoulders(e.target.value)}
                  step="0.1"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-black-700 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('measurements.inseam')} ({unit === 'METRIC' ? 'cm' : 'in'})
                </label>
                <input
                  type="number"
                  value={inseam}
                  onChange={(e) => setInseam(e.target.value)}
                  step="0.1"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-black-700 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('measurements.height')} ({unit === 'METRIC' ? 'cm' : 'in'})
                </label>
                <input
                  type="number"
                  value={height}
                  onChange={(e) => setHeight(e.target.value)}
                  step="0.1"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-black-700 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('measurements.weight')} ({unit === 'METRIC' ? 'kg' : 'lbs'})
                </label>
                <input
                  type="number"
                  value={weight}
                  onChange={(e) => setWeight(e.target.value)}
                  step="0.1"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-black-700 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('measurements.preferredSize')}</label>
                <select
                  value={preferredSize}
                  onChange={(e) => setPreferredSize(e.target.value as SizeOption)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-black-700 focus:border-transparent"
                >
                  <option value="">{t('measurements.notSpecified')}</option>
                  {sizes.map((size) => (
                    <option key={size} value={size}>{tSizes(size)}</option>
                  ))}
                </select>
              </div>
            </div>

            <button
              onClick={handleSaveMeasurements}
              disabled={loading}
              className="w-full px-4 py-2 bg-black-700 text-white rounded-md hover:bg-black-800 disabled:opacity-50"
            >
              {loading ? tCommon('loading') : t('measurements.save')}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
