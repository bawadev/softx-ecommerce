'use client'

import { useState, useRef, useEffect } from 'react'
import Image from 'next/image'
import type { ProductWithVariants } from '@/lib/repositories/product.repository'
import type { ProductCategory, ProductGender, SizeOption, Product } from '@/lib/types'
import type { Category } from '@/lib/repositories/category.repository'
import { getCategoryByIdAction } from '@/app/actions/categories'
import { addProductImageAction, removeProductImageAction } from '@/app/actions/admin-products'
import { uploadMultipleImages, deleteImage } from '@/app/actions/upload'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import SizeVariantCard from '@/components/admin/SizeVariantCard'
import ColorPicker from '@/components/admin/ColorPicker'

interface ProductFormDialogProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (formData: FormData, variants: VariantFormData[]) => Promise<void>
  editingProduct: ProductWithVariants | null
  isEditing: boolean
  allBrands: string[]
  onOpenCategoryPicker: () => void
  selectedCategoryIds: string[]
}

export type FormData = {
  name: string
  description: string
  brand: string
  categoryIds: string[]
  gender: ProductGender
  stockPrice: string
  retailPrice: string
  sku: string
  images: string[]
}

export type VariantFormData = {
  id?: string
  size: SizeOption
  color: string
  stockQuantity: number
}

// New hierarchical variant structure for UI
export type ColorQty = {
  color: string
  quantity: number
}

export type SizeVariantData = {
  colors: ColorQty[]
  total: number
}

export type SizeVariants = Record<SizeOption, SizeVariantData>

const GENDERS: ProductGender[] = ['MEN', 'WOMEN', 'UNISEX']
const SIZES: SizeOption[] = ['XS', 'S', 'M', 'L', 'XL', 'XXL']

export default function ProductFormDialog({
  isOpen,
  onClose,
  onSubmit,
  editingProduct,
  isEditing,
  allBrands,
  onOpenCategoryPicker,
  selectedCategoryIds,
}: ProductFormDialogProps) {
  const [formData, setFormData] = useState<FormData>({
    name: '',
    description: '',
    brand: '',
    categoryIds: [],
    gender: 'UNISEX',
    stockPrice: '',
    retailPrice: '',
    sku: '',
    images: [],
  })

  // Hierarchical variant state
  const [sizeVariants, setSizeVariants] = useState<SizeVariants>({} as SizeVariants)
  const [addingColorForSize, setAddingColorForSize] = useState<SizeOption | null>(null)
  const [newColorForm, setNewColorForm] = useState<ColorQty>({ color: '', quantity: 0 })

  // Autocomplete
  const [showBrandSuggestions, setShowBrandSuggestions] = useState(false)
  const [brandSuggestions, setBrandSuggestions] = useState<string[]>([])
  const brandInputRef = useRef<HTMLInputElement>(null)
  const brandSuggestionsRef = useRef<HTMLDivElement>(null)

  // Selected categories
  const [selectedCategories, setSelectedCategories] = useState<Category[]>([])

  // Image management
  const [productImages, setProductImages] = useState<string[]>([])
  const [uploadingImages, setUploadingImages] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [isDraggingOver, setIsDraggingOver] = useState(false)
  const [uploadMode, setUploadMode] = useState<'file' | 'url'>('file')
  const [urlInput, setUrlInput] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Confirm dialog state
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean
    title: string
    message: string
    onConfirm: () => void
  }>({ isOpen: false, title: '', message: '', onConfirm: () => {} })

  // Load categories when categoryIds change
  useEffect(() => {
    const loadCategories = async () => {
      if (selectedCategoryIds.length > 0) {
        const categories = await Promise.all(
          selectedCategoryIds.map(async (id) => {
            const result = await getCategoryByIdAction(id)
            return result.success && result.data ? result.data : null
          })
        )
        setSelectedCategories(categories.filter((c): c is Category => c !== null))
      } else {
        setSelectedCategories([])
      }
    }
    loadCategories()
  }, [selectedCategoryIds])

  // Filter brands
  useEffect(() => {
    if (formData.brand.length === 0) {
      setBrandSuggestions([])
      return
    }

    const filtered = allBrands
      .filter((brand) => brand.toLowerCase().includes(formData.brand.toLowerCase()))
      .slice(0, 10)

    setBrandSuggestions(filtered)
  }, [formData.brand, allBrands])

  // Click outside to close suggestions
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        brandSuggestionsRef.current &&
        !brandSuggestionsRef.current.contains(event.target as Node) &&
        brandInputRef.current &&
        !brandInputRef.current.contains(event.target as Node)
      ) {
        setShowBrandSuggestions(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Sync categoryIds with selectedCategoryIds
  useEffect(() => {
    setFormData(prev => ({
      ...prev,
      categoryIds: selectedCategoryIds
    }))
  }, [selectedCategoryIds])

  // Load product data when editing or reset when dialog closes
  useEffect(() => {
    if (isEditing && editingProduct) {
      setFormData({
        name: editingProduct.name,
        description: editingProduct.description,
        brand: editingProduct.brand,
        categoryIds: selectedCategoryIds,
        gender: editingProduct.gender,
        stockPrice: editingProduct.stockPrice.toString(),
        retailPrice: editingProduct.retailPrice.toString(),
        sku: editingProduct.sku,
        images: editingProduct.images || [],
      })

      setSizeVariants(
        convertToSizeVariants(
          editingProduct.variants.map((v) => ({
            id: v.id,
            size: v.size,
            color: v.color,
            stockQuantity: v.stockQuantity,
          }))
        )
      )

      // Load product images
      setProductImages(editingProduct.images || [])
    } else if (!isOpen) {
      // Only reset form when dialog closes
      setFormData({
        name: '',
        description: '',
        brand: '',
        categoryIds: [],
        gender: 'UNISEX',
        stockPrice: '',
        retailPrice: '',
        sku: '',
        images: [],
      })
      setSizeVariants({} as SizeVariants)
      setProductImages([])
    }
  }, [isEditing, editingProduct, isOpen])

  const handleImageUpload = async (files: FileList) => {
    if (!files || files.length === 0) return

    setUploadingImages(true)
    setUploadError(null)

    try {
      const formData = new FormData()
      for (let i = 0; i < files.length; i++) {
        formData.append('files', files[i])
      }

      const uploadResult = await uploadMultipleImages(formData)

      if (uploadResult.success && uploadResult.urls) {
        // If editing, add images to product in database
        if (isEditing && editingProduct) {
          for (const url of uploadResult.urls) {
            await addProductImageAction(editingProduct.id, url)
          }
        }

        // Update local state
        setProductImages([...productImages, ...uploadResult.urls])
      } else {
        setUploadError('Failed to upload images. Please try again.')
      }
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : 'Failed to upload images. Please try again.')
    } finally {
      setUploadingImages(false)
    }
  }

  const handleImageRemove = (imageUrl: string) => {
    setConfirmDialog({
      isOpen: true,
      title: 'Remove Image',
      message: 'Are you sure you want to remove this image?',
      onConfirm: async () => {
        setConfirmDialog(prev => ({ ...prev, isOpen: false }))
        try {
          if (isEditing && editingProduct) {
            await removeProductImageAction(editingProduct.id, imageUrl)
            await deleteImage(imageUrl)
          }
          setProductImages(productImages.filter((img) => img !== imageUrl))
        } catch (error) {
          setUploadError(error instanceof Error ? error.message : 'Failed to remove image.')
        }
      },
    })
  }

  const handleUrlSubmit = async () => {
    if (!urlInput.trim()) return

    try {
      // If editing, add image to product in database
      if (isEditing && editingProduct) {
        await addProductImageAction(editingProduct.id, urlInput.trim())
      }

      // Update local state
      setProductImages([...productImages, urlInput.trim()])
      setUrlInput('')
    } catch (error) {
      console.error('URL submit error:', error)
    }
  }

  // Hierarchical variant handlers
  const handleAddSizeVariant = (size: SizeOption) => {
    if (!size) return

    setSizeVariants(prev => ({
      ...prev,
      [size]: { colors: [], total: 0 }
    }))
  }

  const handleDeleteSizeVariant = (size: SizeOption) => {
    setConfirmDialog({
      isOpen: true,
      title: 'Remove Size Variant',
      message: `Are you sure you want to remove size ${size}? All colors in this size will be removed.`,
      onConfirm: () => {
        setConfirmDialog(prev => ({ ...prev, isOpen: false }))
        setSizeVariants(prev => {
          const updated = { ...prev }
          delete updated[size]
          return updated
        })
      },
    })
  }

  const handleAddColor = (size: SizeOption) => {
    setAddingColorForSize(size)
    setNewColorForm({ color: '', quantity: 0 })
  }

  const handleSaveColor = () => {
    if (!addingColorForSize || !newColorForm.color.trim()) {
      alert('Please select a color')
      return
    }

    setSizeVariants(prev => ({
      ...prev,
      [addingColorForSize]: {
        ...prev[addingColorForSize],
        colors: [...prev[addingColorForSize].colors, newColorForm],
        total: prev[addingColorForSize].total + newColorForm.quantity
      }
    }))

    setAddingColorForSize(null)
    setNewColorForm({ color: '', quantity: 0 })
  }

  const handleEditColorQty = (size: SizeOption, index: number, updatedColorQty: ColorQty) => {
    setSizeVariants(prev => {
      const sizeData = prev[size]
      const oldQuantity = sizeData.colors[index]?.quantity || 0
      const quantityDiff = updatedColorQty.quantity - oldQuantity

      const updatedColors = [...sizeData.colors]
      updatedColors[index] = updatedColorQty

      return {
        ...prev,
        [size]: {
          ...sizeData,
          colors: updatedColors,
          total: sizeData.total + quantityDiff
        }
      }
    })
  }

  const handleDeleteColor = (size: SizeOption, index: number) => {
    setConfirmDialog({
      isOpen: true,
      title: 'Remove Color',
      message: 'Are you sure you want to remove this color?',
      onConfirm: () => {
        setConfirmDialog(prev => ({ ...prev, isOpen: false }))
        setSizeVariants(prev => {
          const sizeData = prev[size]
          const removedQuantity = sizeData.colors[index]?.quantity || 0

          return {
            ...prev,
            [size]: {
              ...sizeData,
              colors: sizeData.colors.filter((_, i) => i !== index),
              total: sizeData.total - removedQuantity
            }
          }
        })
      },
    })
  }

  // Convert hierarchical UI state to flat variants for submission
  const convertToFlatVariants = (): VariantFormData[] => {
    const flatVariants: VariantFormData[] = []

    Object.entries(sizeVariants).forEach(([size, sizeData]) => {
      sizeData.colors.forEach((colorQty) => {
        flatVariants.push({
          size: size as SizeOption,
          color: colorQty.color,
          stockQuantity: colorQty.quantity
        })
      })
    })

    return flatVariants
  }

  // Convert flat variants from DB to hierarchical UI state
  const convertToSizeVariants = (flatVariants: VariantFormData[]): SizeVariants => {
    const hierarchical: SizeVariants = {} as SizeVariants

    flatVariants.forEach((variant) => {
      if (!hierarchical[variant.size]) {
        hierarchical[variant.size] = { colors: [], total: 0 }
      }
      hierarchical[variant.size].colors.push({
        color: variant.color,
        quantity: variant.stockQuantity
      })
      hierarchical[variant.size].total += variant.stockQuantity
    })

    return hierarchical
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    // Sync categoryIds and images from state before submitting
    const submissionData = {
      ...formData,
      categoryIds: selectedCategoryIds,
      images: productImages
    }
    await onSubmit(submissionData, convertToFlatVariants())
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Dialog Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-black-700">
              {isEditing ? 'Edit Product' : 'Add New Product'}
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              {isEditing ? 'Update product details and variants' : 'Create a new product with variants'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
            aria-label="Close dialog"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Form Content */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Product Fields Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Product Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Product Name *
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-500 focus:border-transparent"
                placeholder="Enter product name"
                required
              />
            </div>

            {/* Brand with Autocomplete */}
            <div className="relative">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Brand *
              </label>
              <input
                ref={brandInputRef}
                type="text"
                value={formData.brand}
                onChange={(e) => {
                  setFormData({ ...formData, brand: e.target.value })
                  setShowBrandSuggestions(true)
                }}
                onFocus={() => setShowBrandSuggestions(true)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-500 focus:border-transparent"
                placeholder="Enter brand"
                required
              />

              {/* Brand Suggestions */}
              {showBrandSuggestions && brandSuggestions.length > 0 && (
                <div
                  ref={brandSuggestionsRef}
                  className="absolute z-20 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto"
                >
                  {brandSuggestions.map((brand) => (
                    <button
                      key={brand}
                      type="button"
                      onClick={() => {
                        setFormData({ ...formData, brand })
                        setShowBrandSuggestions(false)
                      }}
                      className="w-full px-4 py-2 text-left hover:bg-gray-50 border-b border-gray-100 last:border-b-0"
                    >
                      <div className="text-sm font-medium text-black-700">{brand}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* SKU */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                SKU
              </label>
              <input
                type="text"
                value={formData.sku}
                onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-500 focus:border-transparent"
                placeholder="Enter SKU (optional)"
              />
            </div>

            {/* Categories */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Categories * <span className="text-xs text-gray-500">(Leaf only)</span>
              </label>
              <button
                type="button"
                onClick={onOpenCategoryPicker}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg hover:border-indigo-500 transition-colors text-left flex items-center justify-between"
              >
                <span className="text-gray-700">
                  {selectedCategoryIds.length > 0
                    ? `${selectedCategoryIds.length} selected`
                    : 'Select categories'}
                </span>
                <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>

            {/* Gender */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Gender *
              </label>
              <select
                value={formData.gender}
                onChange={(e) => setFormData({ ...formData, gender: e.target.value as ProductGender })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-500 focus:border-transparent"
                required
              >
                {GENDERS.map((gen) => (
                  <option key={gen} value={gen}>
                    {gen}
                  </option>
                ))}
              </select>
            </div>

            {/* Stock Price */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Stock Price ($) *
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={formData.stockPrice}
                onChange={(e) => setFormData({ ...formData, stockPrice: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-500 focus:border-transparent"
                placeholder="0.00"
                required
              />
            </div>

            {/* Retail Price */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Retail Price ($) *
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={formData.retailPrice}
                onChange={(e) => setFormData({ ...formData, retailPrice: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-500 focus:border-transparent"
                placeholder="0.00"
                required
              />
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description
            </label>
            <textarea
              rows={3}
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-500 focus:border-transparent resize-none"
              placeholder="Enter product description"
            />
          </div>

          {/* Product Images Section */}
          <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-700">Product Images</h3>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setUploadMode('file')}
                  className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
                    uploadMode === 'file'
                      ? 'bg-black-700 text-white'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  Upload
                </button>
                <button
                  type="button"
                  onClick={() => setUploadMode('url')}
                  className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
                    uploadMode === 'url'
                      ? 'bg-black-700 text-white'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  URL
                </button>
              </div>
            </div>
            <p className="text-xs text-gray-500 mb-3">
              Images are shared across all product variants. Upload up to 5 images.
            </p>

            {/* Upload Error */}
            {uploadError && (
              <div className="mb-3 p-2 bg-red-50 border border-red-200 rounded-lg flex items-center justify-between">
                <p className="text-xs text-red-700">{uploadError}</p>
                <button
                  type="button"
                  onClick={() => setUploadError(null)}
                  className="text-red-400 hover:text-red-600 ml-2"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            )}

            {/* Current Images */}
            {productImages.length > 0 && (
              <div className="mb-4">
                <label className="block text-xs font-medium text-gray-600 mb-2">
                  Current Images ({productImages.length})
                </label>
                <div className="flex flex-wrap gap-2">
                  {productImages.map((imageUrl, idx) => (
                    <div key={idx} className="relative group">
                      <div className="h-20 w-20 rounded-lg overflow-hidden bg-white border-2 border-gray-300 hover:ring-2 hover:ring-blue-400 transition-all shadow-sm">
                        <Image
                          src={imageUrl}
                          alt={`Product image ${idx + 1}`}
                          width={80}
                          height={80}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => handleImageRemove(imageUrl)}
                        className="absolute -top-1 -right-1 p-0.5 bg-red-600 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-700 shadow-md"
                        title="Remove image"
                      >
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Upload Area */}
            {productImages.length < 5 && (
              <div>
                {uploadMode === 'file' ? (
                  <>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Upload Images</label>
                    <input
                      ref={fileInputRef}
                      type="file"
                      multiple
                      accept="image/*"
                      onChange={(e) => {
                        if (e.target.files) {
                          handleImageUpload(e.target.files)
                          setIsDraggingOver(false)
                        }
                      }}
                      className="hidden"
                    />
                    <div
                      onDragOver={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        setIsDraggingOver(true)
                      }}
                      onDragLeave={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        setIsDraggingOver(false)
                      }}
                      onDrop={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        setIsDraggingOver(false)
                        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                          handleImageUpload(e.dataTransfer.files)
                        }
                      }}
                      onClick={() => !uploadingImages && fileInputRef.current?.click()}
                      className={`flex flex-col items-center justify-center border-2 border-dashed rounded-lg p-6 cursor-pointer transition-all ${
                        isDraggingOver
                          ? 'bg-gray-500 bg-gray-100'
                          : uploadingImages
                          ? 'border-gray-300 bg-gray-100 cursor-not-allowed'
                          : 'border-gray-300 hover:border-black-400 hover:bg-gray-100'
                      }`}
                      style={{ minHeight: '120px' }}
                    >
                      {uploadingImages ? (
                        <>
                          <svg className="w-10 h-10 text-black-500 animate-spin mb-3" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path
                              className="opacity-75"
                              fill="currentColor"
                              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                            ></path>
                          </svg>
                          <p className="text-sm text-gray-600 font-medium">Uploading...</p>
                        </>
                      ) : (
                        <>
                          <svg className="w-10 h-10 text-gray-400 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                            />
                          </svg>
                          <p className="text-sm text-gray-700 font-medium mb-1">
                            {isDraggingOver ? 'Drop images here' : 'Drag & drop images'}
                          </p>
                          <p className="text-xs text-gray-500 mb-2">or</p>
                          <button
                            type="button"
                            className="px-4 py-1.5 text-xs font-medium text-white bg-black-700 hover:bg-black-800 rounded-lg transition-colors"
                            onClick={(e) => {
                              e.stopPropagation()
                              fileInputRef.current?.click()
                            }}
                          >
                            Browse Files
                          </button>
                          <p className="text-xs text-gray-400 mt-3">PNG, JPG, GIF up to 5MB each</p>
                        </>
                      )}
                    </div>
                  </>
                ) : (
                  <>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Image URL</label>
                    <div className="flex gap-2">
                      <input
                        type="url"
                        value={urlInput}
                        onChange={(e) => setUrlInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault()
                            handleUrlSubmit()
                          }
                        }}
                        placeholder="https://example.com/image.jpg"
                        className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                      <button
                        type="button"
                        onClick={handleUrlSubmit}
                        disabled={!urlInput.trim()}
                        className="px-4 py-2 text-sm font-medium text-white bg-black-700 hover:bg-black-800 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Add
                      </button>
                    </div>
                    <p className="text-xs text-gray-400 mt-2">Enter the full URL of the image</p>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Selected Categories Chips */}
          {selectedCategories.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {selectedCategories.map((category) => {
                const hierarchyColor =
                  category.hierarchy === 'ladies'
                    ? 'bg-gray-100 text-black-700'
                    : category.hierarchy === 'gents'
                    ? 'bg-gray-100 text-black-700'
                    : category.hierarchy === 'kids'
                    ? 'bg-green-100 text-green-800'
                    : 'bg-gray-100 text-black-700'

                return (
                  <div
                    key={category.id}
                    className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm ${hierarchyColor}`}
                  >
                    <span>{category.name}</span>
                    <span className="text-xs opacity-70">({category.hierarchy})</span>
                  </div>
                )
              })}
            </div>
          )}

          {/* Variants Section */}
          <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-700">Product Variants *</h3>
              <div className="flex items-center gap-2">
                <select
                  value=""
                  onChange={(e) => {
                    if (e.target.value) {
                      handleAddSizeVariant(e.target.value as SizeOption)
                      // Reset select to default
                      e.target.value = ''
                    }
                  }}
                  className="px-3 py-1.5 text-xs font-medium border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  disabled={Object.keys(sizeVariants).length >= SIZES.length}
                >
                  <option value="" disabled>
                    {Object.keys(sizeVariants).length === 0
                      ? '+ Add Size Variant'
                      : '+ Add Another Size'}
                  </option>
                  {SIZES.filter(size => !Object.keys(sizeVariants).includes(size)).map((size) => (
                    <option key={size} value={size}>
                      {size}
                    </option>
                  ))}
                </select>
                {Object.keys(sizeVariants).length >= SIZES.length && (
                  <span className="text-xs text-gray-500">All sizes added</span>
                )}
              </div>
            </div>

            {/* Size Variant Cards */}
            {Object.keys(sizeVariants).length > 0 ? (
              <div className="space-y-3">
                {Object.entries(sizeVariants).map(([size, sizeData]) => (
                  <SizeVariantCard
                    key={size}
                    size={size as SizeOption}
                    colorQtys={sizeData.colors}
                    onAddColor={handleAddColor}
                    onEditColor={handleEditColorQty}
                    onDeleteColor={handleDeleteColor}
                    onDeleteSize={handleDeleteSizeVariant}
                  />
                ))}
              </div>
            ) : (
              <div className="text-center py-6 text-sm text-gray-500 italic">
                No size variants added yet. Select a size from the dropdown to get started.
              </div>
            )}

            {/* Grand Total Display */}
            {Object.keys(sizeVariants).length > 0 && (
              <div className="mt-4 p-4 bg-gray-50 border border-navy-200 rounded-lg">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-black-700">Total T-Shirts (All Sizes):</span>
                  <span className="text-xl font-bold text-black-700">
                    {Object.values(sizeVariants).reduce((sum, sizeVar) => sum + sizeVar.total, 0)}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Dialog Footer */}
          <div className="sticky bottom-0 bg-white border-t border-gray-200 -mx-6 -mb-6 px-6 py-4 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-black-700 text-white rounded-lg hover:bg-black-800 font-medium"
            >
              {isEditing ? 'Update Product' : 'Create Product'}
            </button>
          </div>
        </form>
      </div>

      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        title={confirmDialog.title}
        message={confirmDialog.message}
        onConfirm={confirmDialog.onConfirm}
        onCancel={() => setConfirmDialog(prev => ({ ...prev, isOpen: false }))}
        type="warning"
      />

      {/* Add Color Dialog */}
      {addingColorForSize && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-96 max-w-full shadow-xl">
            <h3 className="text-lg font-semibold mb-4 text-black-700">
              Add Color to Size {addingColorForSize}
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Color *
                </label>
                <ColorPicker
                  value={newColorForm.color}
                  onChange={(color) => setNewColorForm({ ...newColorForm, color })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Quantity *
                </label>
                <input
                  type="number"
                  min="0"
                  value={newColorForm.quantity}
                  onChange={(e) =>
                    setNewColorForm({ ...newColorForm, quantity: parseInt(e.target.value) || 0 })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder="0"
                />
              </div>
              <div className="flex gap-2 justify-end pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setAddingColorForSize(null)
                    setNewColorForm({ color: '', quantity: 0 })
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-medium text-sm"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveColor}
                  className="px-4 py-2 bg-black-700 text-white rounded-lg hover:bg-black-800 font-medium text-sm"
                >
                  Add Color
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
