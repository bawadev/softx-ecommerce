'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { useLocale } from 'next-intl'
import type { HeroSlide, HeroAnimationType, PromotionalCategory, HeroColorTheme } from '@/lib/types'
import {
  createHeroSlideAction,
  updateHeroSlideAction,
  deleteHeroSlideAction,
  reorderHeroSlidesAction,
} from '@/app/actions/hero-slides'
import { deleteImage } from '@/app/actions/upload'
import ImageUpload from '@/components/ui/ImageUpload'
import Notification from '@/components/ui/Notification'
import { shopConfig } from '@/config/shop'
import ConfirmDialog from '@/components/ui/ConfirmDialog'

const ANIMATION_OPTIONS: { value: HeroAnimationType; label: string }[] = [
  { value: 'left-panel', label: 'Left Panel' },
  { value: 'top-left-round', label: 'Top Left Round' },
  { value: 'top-right-panel', label: 'Top Right Panel' },
  { value: 'bottom-right-quarter', label: 'Bottom Right Quarter' },
]

const COLOR_THEME_OPTIONS: { value: HeroColorTheme; label: string; description: string }[] = [
  { value: 'light', label: 'Light', description: 'White/transparent panels' },
  { value: 'dark', label: 'Dark', description: 'Black/transparent panels' },
]

interface HeroSlidesClientProps {
  initialSlides: HeroSlide[]
  promotionalCategories: PromotionalCategory[]
}

type FormData = {
  imageUrl: string
  mobileImageUrl: string
  animationType: HeroAnimationType
  colorTheme: HeroColorTheme
  badgeText: string
  title: string
  subtitle: string
  linkUrl: string
  isActive: boolean
}

const emptyForm: FormData = {
  imageUrl: '',
  mobileImageUrl: '',
  animationType: 'left-panel',
  colorTheme: 'light',
  badgeText: '',
  title: '',
  subtitle: '',
  linkUrl: '',
  isActive: true,
}

export default function HeroSlidesClient({ initialSlides, promotionalCategories }: HeroSlidesClientProps) {
  const locale = useLocale()
  const [slides, setSlides] = useState<HeroSlide[]>(initialSlides)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingSlide, setEditingSlide] = useState<HeroSlide | null>(null)
  const [form, setForm] = useState<FormData>(emptyForm)
  const [saving, setSaving] = useState(false)
  const [sectionDropdownOpen, setSectionDropdownOpen] = useState(false)
  const sectionDropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (sectionDropdownRef.current && !sectionDropdownRef.current.contains(e.target as Node)) {
        setSectionDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Notification
  const [notification, setNotification] = useState<{
    type: 'success' | 'error'
    title: string
    message?: string
  } | null>(null)

  // Confirm dialog
  const [confirmDialog, setConfirmDialog] = useState<{
    slideId: string
    title: string
  } | null>(null)

  const showNotification = (type: 'success' | 'error', title: string, message?: string) => {
    setNotification({ type, title, message })
  }

  const openCreateModal = () => {
    setEditingSlide(null)
    setForm(emptyForm)
    setIsModalOpen(true)
  }

  const openEditModal = (slide: HeroSlide) => {
    setEditingSlide(slide)
    setForm({
      imageUrl: slide.imageUrl,
      mobileImageUrl: slide.mobileImageUrl || '',
      animationType: slide.animationType,
      colorTheme: slide.colorTheme,
      badgeText: slide.badgeText,
      title: slide.title,
      subtitle: slide.subtitle,
      linkUrl: slide.linkUrl || '',
      isActive: slide.isActive,
    })
    setIsModalOpen(true)
  }

  const closeModal = () => {
    setIsModalOpen(false)
    setEditingSlide(null)
    setForm(emptyForm)
  }

  const handleSave = async () => {
    if (!form.imageUrl) {
      showNotification('error', 'Image required', 'Please upload an image for the slide.')
      return
    }
    if (!form.title.trim()) {
      showNotification('error', 'Title required', 'Please enter a title for the slide.')
      return
    }

    setSaving(true)

    const sanitizedLinkUrl = form.linkUrl === '__custom__' ? '' : form.linkUrl

    try {
      if (editingSlide) {
        // Update existing
        const result = await updateHeroSlideAction(editingSlide.id, {
          imageUrl: form.imageUrl,
          mobileImageUrl: form.mobileImageUrl || null,
          animationType: form.animationType,
          colorTheme: form.colorTheme,
          badgeText: form.badgeText,
          title: form.title,
          subtitle: form.subtitle,
          linkUrl: sanitizedLinkUrl,
          isActive: form.isActive,
        })

        if (result.success && result.data) {
          // If image changed, delete old image from MinIO
          if (editingSlide.imageUrl !== form.imageUrl && editingSlide.imageUrl) {
            try {
              await deleteImage(editingSlide.imageUrl)
            } catch {
              // Best effort
            }
          }
          if (
            editingSlide.mobileImageUrl &&
            editingSlide.mobileImageUrl !== form.mobileImageUrl
          ) {
            try {
              await deleteImage(editingSlide.mobileImageUrl)
            } catch {
              // Best effort
            }
          }
          setSlides((prev) =>
            prev.map((s) => (s.id === editingSlide.id ? result.data! : s))
          )
          showNotification('success', 'Slide updated')
          closeModal()
        } else {
          showNotification('error', 'Failed to update', result.message)
        }
      } else {
        // Create new
        const displayOrder = slides.length
        const result = await createHeroSlideAction({
          ...form,
          linkUrl: sanitizedLinkUrl,
          displayOrder,
        })

        if (result.success && result.data) {
          setSlides((prev) => [...prev, result.data!])
          showNotification('success', 'Slide created')
          closeModal()
        } else {
          showNotification('error', 'Failed to create', result.message)
        }
      }
    } catch (err) {
      showNotification('error', 'Error', 'An unexpected error occurred.')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (slideId: string) => {
    const result = await deleteHeroSlideAction(slideId)
    if (result.success) {
      setSlides((prev) => prev.filter((s) => s.id !== slideId))
      showNotification('success', 'Slide deleted')
    } else {
      showNotification('error', 'Failed to delete', result.message)
    }
    setConfirmDialog(null)
  }

  const handleToggleActive = async (slide: HeroSlide) => {
    const result = await updateHeroSlideAction(slide.id, { isActive: !slide.isActive })
    if (result.success && result.data) {
      setSlides((prev) =>
        prev.map((s) => (s.id === slide.id ? result.data! : s))
      )
    } else {
      showNotification('error', 'Failed to update', result.message)
    }
  }

  const handleMoveUp = async (index: number) => {
    if (index === 0) return
    const newSlides = [...slides]
    ;[newSlides[index - 1], newSlides[index]] = [newSlides[index], newSlides[index - 1]]
    const reorderData = newSlides.map((s, i) => ({ id: s.id, displayOrder: i }))
    const result = await reorderHeroSlidesAction(reorderData)
    if (result.success) {
      setSlides(newSlides.map((s, i) => ({ ...s, displayOrder: i })))
    } else {
      showNotification('error', 'Failed to reorder', result.message)
    }
  }

  const handleMoveDown = async (index: number) => {
    if (index === slides.length - 1) return
    const newSlides = [...slides]
    ;[newSlides[index], newSlides[index + 1]] = [newSlides[index + 1], newSlides[index]]
    const reorderData = newSlides.map((s, i) => ({ id: s.id, displayOrder: i }))
    const result = await reorderHeroSlidesAction(reorderData)
    if (result.success) {
      setSlides(newSlides.map((s, i) => ({ ...s, displayOrder: i })))
    } else {
      showNotification('error', 'Failed to reorder', result.message)
    }
  }

  const getAnimationLabel = (type: HeroAnimationType) =>
    ANIMATION_OPTIONS.find((o) => o.value === type)?.label || type

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-black-700">Hero Slides</h1>
              <p className="mt-1 text-sm text-gray-600">
                Manage homepage hero slider images and content
              </p>
            </div>
            <Link
              href={`/${locale}/admin`}
              className="text-sm text-black-700 hover:text-black-700 font-medium flex-shrink-0"
            >
              ← Back to Dashboard
            </Link>
          </div>
          <button
            onClick={openCreateModal}
            className="mt-4 w-full sm:w-auto px-4 py-2 bg-black-700 text-white rounded-lg hover:bg-black-800 transition-colors text-sm font-medium"
          >
            + Add Slide
          </button>
        </div>
      </div>

      {/* Slides List */}
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {slides.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-lg border border-gray-200">
            <svg
              className="mx-auto h-12 w-12 text-gray-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
            <h3 className="mt-4 text-lg font-medium text-black-700">No hero slides</h3>
            <p className="mt-2 text-sm text-gray-600">
              Get started by creating your first hero slide.
            </p>
            <button
              onClick={openCreateModal}
              className="mt-4 px-4 py-2 bg-black-700 text-white rounded-lg hover:bg-black-800 transition-colors text-sm font-medium"
            >
              + Add Slide
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {slides.map((slide, index) => (
              <div
                key={slide.id}
                className={`bg-white rounded-lg border shadow-sm overflow-hidden ${
                  slide.isActive ? 'border-gray-200' : 'border-gray-200 opacity-60'
                }`}
              >
                {/* Desktop layout */}
                <div className="hidden sm:flex items-center gap-4 p-4">
                  {/* Reorder controls */}
                  <div className="flex flex-col gap-1">
                    <button
                      onClick={() => handleMoveUp(index)}
                      disabled={index === 0}
                      className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed"
                      aria-label="Move up"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                      </svg>
                    </button>
                    <button
                      onClick={() => handleMoveDown(index)}
                      disabled={index === slides.length - 1}
                      className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed"
                      aria-label="Move down"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                  </div>

                  {/* Order number */}
                  <div className="flex-shrink-0 w-8 h-8 flex items-center justify-center bg-gray-100 rounded-full text-sm font-bold text-gray-600">
                    {index + 1}
                  </div>

                  {/* Thumbnail */}
                  <div className="flex-shrink-0 w-32 h-20 rounded-lg overflow-hidden bg-gray-100">
                    <img
                      src={slide.imageUrl}
                      alt={slide.title}
                      className="w-full h-full object-cover"
                    />
                  </div>

                  {/* Slide info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-base font-semibold text-black-700 truncate">
                        {slide.title}
                      </h3>
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-black-700">
                        {getAnimationLabel(slide.animationType)}
                      </span>
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                          slide.colorTheme === 'light'
                            ? 'bg-white border border-gray-300 text-gray-700'
                            : 'bg-gray-800 text-white'
                        }`}
                        title={`Color theme: ${slide.colorTheme}`}
                      >
                        {slide.colorTheme === 'light' ? '☀️ Light' : '🌙 Dark'}
                      </span>
                    </div>
                    {slide.badgeText && (
                      <p className="text-xs text-gray-500 truncate mb-0.5">{slide.badgeText}</p>
                    )}
                    <p className="text-sm text-gray-600 truncate">{slide.subtitle}</p>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      onClick={() => handleToggleActive(slide)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        slide.isActive ? 'bg-green-500' : 'bg-gray-300'
                      }`}
                      aria-label={slide.isActive ? 'Deactivate' : 'Activate'}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          slide.isActive ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                    <button
                      onClick={() => openEditModal(slide)}
                      className="p-2 text-gray-400 hover:text-black-700 transition-colors"
                      aria-label="Edit"
                    >
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                        />
                      </svg>
                    </button>
                    <button
                      onClick={() =>
                        setConfirmDialog({
                          slideId: slide.id,
                          title: slide.title,
                        })
                      }
                      className="p-2 text-gray-400 hover:text-red-600 transition-colors"
                      aria-label="Delete"
                    >
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                        />
                      </svg>
                    </button>
                  </div>
                </div>

                {/* Mobile layout */}
                <div className="sm:hidden p-3">
                  <div className="flex gap-3">
                    {/* Reorder + Order number */}
                    <div className="flex flex-col items-center gap-1 flex-shrink-0">
                      <button
                        onClick={() => handleMoveUp(index)}
                        disabled={index === 0}
                        className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed"
                        aria-label="Move up"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                        </svg>
                      </button>
                      <div className="w-7 h-7 flex items-center justify-center bg-gray-100 rounded-full text-xs font-bold text-gray-600">
                        {index + 1}
                      </div>
                      <button
                        onClick={() => handleMoveDown(index)}
                        disabled={index === slides.length - 1}
                        className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed"
                        aria-label="Move down"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                    </div>

                    {/* Content area */}
                    <div className="flex-1 min-w-0">
                      {/* Thumbnail */}
                      <div className="w-full h-32 rounded-lg overflow-hidden bg-gray-100 mb-2">
                        <img
                          src={slide.imageUrl}
                          alt={slide.title}
                          className="w-full h-full object-cover"
                        />
                      </div>

                      {/* Info */}
                      <h3 className="text-sm font-semibold text-black-700 truncate">
                        {slide.title}
                      </h3>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-black-700">
                          {getAnimationLabel(slide.animationType)}
                        </span>
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                            slide.colorTheme === 'light'
                              ? 'bg-white border border-gray-300 text-gray-700'
                              : 'bg-gray-800 text-white'
                          }`}
                        >
                          {slide.colorTheme === 'light' ? '☀️' : '🌙'}
                        </span>
                        {slide.badgeText && (
                          <span className="text-xs text-gray-500 truncate">{slide.badgeText}</span>
                        )}
                      </div>
                      {slide.subtitle && (
                        <p className="text-xs text-gray-600 truncate mt-1">{slide.subtitle}</p>
                      )}

                      {/* Actions row */}
                      <div className="flex items-center gap-3 mt-2 pt-2 border-t border-gray-100">
                        <button
                          onClick={() => handleToggleActive(slide)}
                          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors flex-shrink-0 ${
                            slide.isActive ? 'bg-green-500' : 'bg-gray-300'
                          }`}
                          aria-label={slide.isActive ? 'Deactivate' : 'Activate'}
                        >
                          <span
                            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                              slide.isActive ? 'translate-x-6' : 'translate-x-1'
                            }`}
                          />
                        </button>
                        <span className="text-xs text-gray-500">{slide.isActive ? 'Active' : 'Inactive'}</span>
                        <div className="ml-auto flex items-center gap-1">
                          <button
                            onClick={() => openEditModal(slide)}
                            className="p-1.5 text-gray-400 hover:text-black-700 transition-colors"
                            aria-label="Edit"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                              />
                            </svg>
                          </button>
                          <button
                            onClick={() =>
                              setConfirmDialog({
                                slideId: slide.id,
                                title: slide.title,
                              })
                            }
                            className="p-1.5 text-gray-400 hover:text-red-600 transition-colors"
                            aria-label="Delete"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                              />
                            </svg>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={closeModal} />
          <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-black-700">
                  {editingSlide ? 'Edit Slide' : 'Add New Slide'}
                </h2>
                <button
                  onClick={closeModal}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="space-y-5">
                {/* Desktop Image Upload */}
                <ImageUpload
                  label="Desktop Background Image (landscape, ~1920×1080)"
                  multiple={false}
                  maxFiles={1}
                  initialImages={form.imageUrl ? [form.imageUrl] : []}
                  onUploadComplete={(urls) => {
                    setForm((prev) => ({ ...prev, imageUrl: urls[0] || '' }))
                  }}
                />

                {/* Mobile Image Upload (optional) */}
                <ImageUpload
                  label="Mobile Background Image — optional (portrait, ~1080×1440). Falls back to desktop image if empty."
                  multiple={false}
                  maxFiles={1}
                  initialImages={form.mobileImageUrl ? [form.mobileImageUrl] : []}
                  onUploadComplete={(urls) => {
                    setForm((prev) => ({ ...prev, mobileImageUrl: urls[0] || '' }))
                  }}
                />

                {/* Animation Type */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Animation Type
                  </label>
                  <select
                    value={form.animationType}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        animationType: e.target.value as HeroAnimationType,
                      }))
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-black-700 focus:border-transparent text-sm"
                  >
                    {ANIMATION_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Color Theme */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Panel Color Theme
                  </label>
                  <div className="space-y-2">
                    {COLOR_THEME_OPTIONS.map((opt) => (
                      <label
                        key={opt.value}
                        className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${
                          form.colorTheme === opt.value
                            ? 'border-black-700 bg-gray-50'
                            : 'border-gray-300 hover:border-gray-400'
                        }`}
                      >
                        <input
                          type="radio"
                          name="colorTheme"
                          value={opt.value}
                          checked={form.colorTheme === opt.value}
                          onChange={(e) =>
                            setForm((prev) => ({
                              ...prev,
                              colorTheme: e.target.value as HeroColorTheme,
                            }))
                          }
                          className="h-4 w-4 text-black-700 focus:ring-black-700"
                        />
                        <div className="flex-1">
                          <div className="font-medium text-sm text-black-700">{opt.label}</div>
                          <div className="text-xs text-gray-500">{opt.description}</div>
                        </div>
                        <div
                          className={`w-16 h-10 rounded ${
                            opt.value === 'light'
                              ? 'bg-gradient-to-br from-white/80 to-transparent border border-gray-300'
                              : 'bg-gradient-to-br from-black/80 to-transparent border border-gray-600'
                          }`}
                          title="Preview"
                        />
                      </label>
                    ))}
                  </div>
                  <p className="mt-1 text-xs text-gray-500">
                    Choose the panel color based on your background image contrast
                  </p>
                </div>

                {/* Title */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Title *
                  </label>
                  <input
                    type="text"
                    value={form.title}
                    onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
                    placeholder={`e.g. ${shopConfig.name}`}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-black-700 focus:border-transparent text-sm"
                  />
                </div>

                {/* Subtitle */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Subtitle
                  </label>
                  <input
                    type="text"
                    value={form.subtitle}
                    onChange={(e) => setForm((prev) => ({ ...prev, subtitle: e.target.value }))}
                    placeholder={`e.g. ${shopConfig.tagline}`}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-black-700 focus:border-transparent text-sm"
                  />
                </div>

                {/* Redirect to Section */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Redirect to Section
                  </label>
                  <div className="relative" ref={sectionDropdownRef}>
                    <button
                      type="button"
                      onClick={() => setSectionDropdownOpen(!sectionDropdownOpen)}
                      className="w-full flex items-center justify-between px-3 py-2 border border-gray-300 rounded-md bg-white text-sm text-left focus:ring-2 focus:ring-black-700 focus:border-transparent"
                    >
                      <span className={form.linkUrl && form.linkUrl !== '__custom__' && promotionalCategories.find((cat) => `/en/shop?promo=${cat.slug}` === form.linkUrl) ? 'text-black-700' : form.linkUrl === '__custom__' || (form.linkUrl && !promotionalCategories.some((cat) => `/en/shop?promo=${cat.slug}` === form.linkUrl)) ? 'text-black-700' : 'text-gray-500'}>
                        {form.linkUrl === ''
                          ? 'None (no link)'
                          : form.linkUrl === '__custom__'
                          ? 'Custom URL'
                          : promotionalCategories.find((cat) => `/en/shop?promo=${cat.slug}` === form.linkUrl)?.name
                            || 'Custom URL'}
                      </span>
                      <svg className={`w-4 h-4 text-gray-400 transition-transform ${sectionDropdownOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                    {sectionDropdownOpen && (
                      <div className="absolute z-20 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                        <button
                          type="button"
                          onClick={() => {
                            setForm((prev) => ({ ...prev, linkUrl: '' }))
                            setSectionDropdownOpen(false)
                          }}
                          className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center gap-2 ${form.linkUrl === '' ? 'bg-gray-50 text-black-700 font-medium' : 'text-gray-700'}`}
                        >
                          <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                          </svg>
                          None (no link)
                        </button>
                        {promotionalCategories.map((cat) => (
                          <button
                            type="button"
                            key={cat.id}
                            onClick={() => {
                              setForm((prev) => ({ ...prev, linkUrl: `/en/shop?promo=${cat.slug}` }))
                              setSectionDropdownOpen(false)
                            }}
                            className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center gap-2 ${form.linkUrl === `/en/shop?promo=${cat.slug}` ? 'bg-gray-50 text-black-700 font-medium' : 'text-gray-700'}`}
                          >
                            <svg className="w-4 h-4 text-black-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                            </svg>
                            {cat.name}
                          </button>
                        ))}
                        <button
                          type="button"
                          onClick={() => {
                            setForm((prev) => ({ ...prev, linkUrl: '__custom__' }))
                            setSectionDropdownOpen(false)
                          }}
                          className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center gap-2 border-t border-gray-100 ${form.linkUrl === '__custom__' || (form.linkUrl && !promotionalCategories.some((cat) => `/en/shop?promo=${cat.slug}` === form.linkUrl) && form.linkUrl !== '') ? 'bg-gray-50 text-black-700 font-medium' : 'text-gray-700'}`}
                        >
                          <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                          </svg>
                          Custom URL
                        </button>
                      </div>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-gray-500">
                    Select a promotional section to link to, or choose &quot;Custom URL&quot; for a manual link.
                  </p>
                  {(form.linkUrl === '__custom__' ||
                    (form.linkUrl &&
                      form.linkUrl !== '__custom__' &&
                      !promotionalCategories.some(
                        (cat) => `/en/shop?promo=${cat.slug}` === form.linkUrl
                      ))) && (
                    <input
                      type="text"
                      value={form.linkUrl === '__custom__' ? '' : form.linkUrl}
                      onChange={(e) => setForm((prev) => ({ ...prev, linkUrl: e.target.value }))}
                      placeholder="e.g. /en/shop?promo=best-sellers"
                      className="mt-2 w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-black-700 focus:border-transparent text-sm"
                    />
                  )}
                </div>

                {/* Active checkbox */}
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="slide-active"
                    checked={form.isActive}
                    onChange={(e) => setForm((prev) => ({ ...prev, isActive: e.target.checked }))}
                    className="h-4 w-4 rounded border-gray-300 text-black-700 focus:ring-black-700"
                  />
                  <label htmlFor="slide-active" className="text-sm text-gray-700">
                    Active (visible on homepage)
                  </label>
                </div>
              </div>

              {/* Footer */}
              <div className="flex gap-3 mt-8">
                <button
                  onClick={closeModal}
                  className="flex-1 px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex-1 px-4 py-2 bg-black-700 text-white rounded-lg hover:bg-black-800 disabled:bg-gray-400 disabled:cursor-not-allowed font-medium transition-colors"
                >
                  {saving ? 'Saving...' : editingSlide ? 'Update Slide' : 'Create Slide'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Notification */}
      <Notification
        type={notification?.type || 'success'}
        title={notification?.title || ''}
        message={notification?.message}
        isOpen={!!notification}
        onClose={() => setNotification(null)}
        autoClose
        autoCloseDelay={3000}
      />

      {/* Confirm Dialog */}
      <ConfirmDialog
        isOpen={!!confirmDialog}
        title="Delete Slide"
        message={`Are you sure you want to delete "${confirmDialog?.title}"? This will also remove the image from storage. This action cannot be undone.`}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        type="danger"
        onConfirm={() => confirmDialog && handleDelete(confirmDialog.slideId)}
        onCancel={() => setConfirmDialog(null)}
      />
    </div>
  )
}
