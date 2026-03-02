'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useLocale } from 'next-intl'
import {
  deleteProductAction,
  createProductAction,
  updateProductAction,
  searchProductsByNameAction,
  checkProductNameExistsAction,
  getAllBrandsAction,
  addVariantImageAction,
  removeVariantImageAction,
} from '@/app/actions/admin-products'
import { uploadMultipleImages, deleteImage } from '@/app/actions/upload'
import {
  getAllPromotionalCategoriesAction,
  addProductToCategoryAction,
} from '@/app/actions/promotional-categories'
import {
  assignProductToCategoriesAction,
  getCategoryTreeAction,
  getCategoryByIdAction,
  getCategoriesForProductAction,
} from '@/app/actions/categories'
import type { ProductWithVariants } from '@/lib/repositories/product.repository'
import type { ProductCategory, ProductGender, Product, PromotionalCategory, SizeOption } from '@/lib/types'
import type { Category } from '@/lib/repositories/category.repository'
import CategoryPickerDialog from '@/components/category/CategoryPickerDialog'
import ProductFormDialog from '@/components/admin/ProductFormDialog'
import Notification, { type NotificationType } from '@/components/ui/Notification'
import ConfirmDialog from '@/components/ui/ConfirmDialog'

interface AdminProductsClientProps {
  products: ProductWithVariants[]
}

type FormData = {
  name: string
  description: string
  brand: string
  category?: ProductCategory // DEPRECATED: Use categoryIds instead
  categoryIds: string[] // Selected category IDs (leaf categories only)
  gender: ProductGender
  stockPrice: string
  retailPrice: string
  sku: string
  images: string[]
}

type VariantFormData = {
  id?: string // For editing existing variants
  size: SizeOption
  color: string
  stockQuantity: number
}

const CATEGORIES: ProductCategory[] = ['SHIRT', 'PANTS', 'JACKET', 'DRESS', 'SHOES', 'ACCESSORIES']
const GENDERS: ProductGender[] = ['MEN', 'WOMEN', 'UNISEX']
const SIZES: SizeOption[] = ['XS', 'S', 'M', 'L', 'XL', 'XXL']

export default function AdminProductsClient({ products: initialProducts }: AdminProductsClientProps) {
  const locale = useLocale()
  const [products, setProducts] = useState(initialProducts)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  // Form state
  const [isEditing, setIsEditing] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingProduct, setEditingProduct] = useState<ProductWithVariants | null>(null)
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

  const [isSubmitting, setIsSubmitting] = useState(false)

  // Brand autocomplete state (for dialog)
  const [allBrands, setAllBrands] = useState<string[]>([])


  // Form dialog state
  const [isDialogOpen, setIsDialogOpen] = useState(false)

  // Sorting state
  const [sortBy, setSortBy] = useState<'name' | 'category' | 'price' | 'variants' | 'stock'>('name')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc')

  // Section assignment state
  const [showSectionDialog, setShowSectionDialog] = useState(false)
  const [selectedProductForSection, setSelectedProductForSection] = useState<ProductWithVariants | null>(null)
  const [promotionalCategories, setPromotionalCategories] = useState<PromotionalCategory[]>([])
  const [sectionQuantities, setSectionQuantities] = useState<Record<string, number>>({})
  const [assigningSections, setAssigningSections] = useState(false)
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null)

  // Category picker state (for form - new/edit products)
  const [showFormCategoryPicker, setShowFormCategoryPicker] = useState(false)
  const [selectedCategories, setSelectedCategories] = useState<Category[]>([])

  // Variant management state
  const [variants, setVariants] = useState<VariantFormData[]>([])
  const [editingVariantIndex, setEditingVariantIndex] = useState<number | null>(null)
  const [variantForm, setVariantForm] = useState<VariantFormData>({
    size: 'M',
    color: '',
    stockQuantity: 0
  })
  const [showVariantForm, setShowVariantForm] = useState(false)

  // Notification state
  const [notification, setNotification] = useState<{
    isOpen: boolean
    type: NotificationType
    title: string
    message?: string
  }>({
    isOpen: false,
    type: 'success',
    title: '',
  })

  // Confirm dialog state
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean
    title: string
    message: string
    onConfirm: () => void
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
  })

  const showNotification = (type: NotificationType, title: string, message?: string) => {
    setNotification({ isOpen: true, type, title, message })
  }

  const closeNotification = () => {
    setNotification(prev => ({ ...prev, isOpen: false }))
  }


  // Load all brands on mount
  useEffect(() => {
    const loadBrands = async () => {
      const result = await getAllBrandsAction()
      if (result.success && result.data) {
        setAllBrands(result.data.brands)
      }
    }
    loadBrands()
  }, [])

  // Load category details when categoryIds change
  useEffect(() => {
    const loadCategories = async () => {
      if (formData.categoryIds.length > 0) {
        const categories = await Promise.all(
          formData.categoryIds.map(async (id) => {
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
  }, [formData.categoryIds])


  const handleDelete = async (productId: string, productName: string) => {
    setConfirmDialog({
      isOpen: true,
      title: 'Delete Product',
      message: `Are you sure you want to delete "${productName}"? This will also delete all its variants.`,
      onConfirm: async () => {
        setConfirmDialog({ ...confirmDialog, isOpen: false })
        setDeletingId(productId)

        const result = await deleteProductAction(productId)

        if (result.success) {
          setProducts(products.filter(p => p.id !== productId))
          // If we're editing this product, reset the form
          if (editingId === productId) {
            resetForm()
          }
          showNotification('success', 'Product deleted successfully')
        } else {
          showNotification('error', 'Failed to delete product', result.message || 'Failed to delete product')
        }

        setDeletingId(null)
      }
    })
  }

  const handleOpenSectionDialog = async (product: ProductWithVariants) => {
    setSelectedProductForSection(product)
    setOpenDropdownId(null)

    // Load promotional categories
    const result = await getAllPromotionalCategoriesAction(false)
    if (result.success && result.data) {
      setPromotionalCategories(result.data)
    }

    setShowSectionDialog(true)
  }

  const handleAssignToSections = async () => {
    if (!selectedProductForSection) return

    const selectedSections = Object.entries(sectionQuantities).filter(([_, qty]) => qty > 0)
    if (selectedSections.length === 0) {
      showNotification('warning', 'No sections selected', 'Please enter at least one quantity')
      return
    }

    const totalStock = selectedProductForSection.variants.reduce((sum, v) => sum + v.stockQuantity, 0)
    const totalAllocated = selectedSections.reduce((sum, [_, qty]) => sum + qty, 0)

    if (totalAllocated > totalStock) {
      showNotification('error', 'Stock exceeded', `Total allocated (${totalAllocated}) cannot exceed available stock (${totalStock})`)
      return
    }

    setAssigningSections(true)

    // Assign to each selected section
    let hasError = false
    for (const [categoryId, quantity] of selectedSections) {
      const result = await addProductToCategoryAction(categoryId, selectedProductForSection.id, quantity)
      if (!result.success) {
        showNotification('error', 'Failed to add to section', result.message || 'Failed to add to section')
        hasError = true
      }
    }

    setAssigningSections(false)
    setShowSectionDialog(false)
    setSectionQuantities({})
    setSelectedProductForSection(null)

    if (!hasError) {
      showNotification('success', 'Product assigned to sections successfully!')
    }
  }

  const loadProductIntoForm = async (product: ProductWithVariants) => {
    setIsEditing(true)
    setEditingId(product.id)
    setEditingProduct(product)

    // Fetch product categories
    const categoriesResult = await getCategoriesForProductAction(product.id)
    const categoryIds = categoriesResult.success && categoriesResult.data ? categoriesResult.data : []

    setFormData({
      name: product.name,
      description: product.description,
      brand: product.brand,
      categoryIds,
      gender: product.gender,
      stockPrice: product.stockPrice.toString(),
      retailPrice: product.retailPrice.toString(),
      sku: product.sku,
      images: product.images || [],
    })

    // Load variants
    setVariants(product.variants.map(v => ({
      id: v.id,
      size: v.size,
      color: v.color,
      stockQuantity: v.stockQuantity
    })))

    // Open dialog
    setIsDialogOpen(true)
  }

  const resetForm = () => {
    setIsEditing(false)
    setEditingId(null)
    setEditingProduct(null)
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
    setVariants([])
    setVariantForm({ size: 'M', color: '', stockQuantity: 0 })
    setShowVariantForm(false)
    setEditingVariantIndex(null)
    setIsDialogOpen(false)
  }

  // Sorting function
  const handleSort = (column: 'name' | 'category' | 'price' | 'variants' | 'stock') => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      setSortBy(column)
      setSortOrder('asc')
    }
  }

  // Sort products
  const sortedProducts = [...products].sort((a, b) => {
    let comparison = 0

    switch (sortBy) {
      case 'name':
        comparison = a.name.localeCompare(b.name)
        break
      case 'category':
        comparison = (a.category || '').localeCompare(b.category || '')
        break
      case 'price':
        comparison = a.stockPrice - b.stockPrice
        break
      case 'variants':
        comparison = a.variants.length - b.variants.length
        break
      case 'stock':
        const aStock = a.variants.reduce((sum, v) => sum + v.stockQuantity, 0)
        const bStock = b.variants.reduce((sum, v) => sum + v.stockQuantity, 0)
        comparison = aStock - bStock
        break
    }

    return sortOrder === 'asc' ? comparison : -comparison
  })

  // Variant management functions
  const handleAddVariant = () => {
    if (!variantForm.size || !variantForm.color.trim()) {
      showNotification('warning', 'Missing information', 'Please fill in size and color')
      return
    }

    if (variantForm.stockQuantity < 0) {
      showNotification('warning', 'Invalid quantity', 'Stock quantity cannot be negative')
      return
    }

    if (editingVariantIndex !== null) {
      // Update existing variant
      const updatedVariants = [...variants]
      updatedVariants[editingVariantIndex] = variantForm
      setVariants(updatedVariants)
      setEditingVariantIndex(null)
    } else {
      // Add new variant
      setVariants([...variants, variantForm])
    }

    // Reset variant form
    setVariantForm({ size: 'M', color: '', stockQuantity: 0 })
    setShowVariantForm(false)
  }

  const handleEditVariant = (index: number) => {
    setVariantForm(variants[index])
    setEditingVariantIndex(index)
    setShowVariantForm(true)
  }

  const handleDeleteVariant = (index: number) => {
    setConfirmDialog({
      isOpen: true,
      title: 'Delete Variant',
      message: 'Are you sure you want to delete this variant?',
      onConfirm: () => {
        setConfirmDialog({ ...confirmDialog, isOpen: false })
        setVariants(variants.filter((_, i) => i !== index))
        showNotification('success', 'Variant deleted')
      }
    })
  }

  const handleCancelVariantForm = () => {
    setVariantForm({ size: 'M', color: '', stockQuantity: 0 })
    setShowVariantForm(false)
    setEditingVariantIndex(null)
  }

  const handleSubmit = async (formDataParam: FormData, variantsParam: VariantFormData[]) => {
    // Validation
    if (!formDataParam.name.trim() || !formDataParam.brand.trim()) {
      showNotification('warning', 'Missing required fields', 'Please fill in all required fields (Name, Brand)')
      return
    }

    if (formDataParam.categoryIds.length === 0) {
      showNotification('warning', 'No categories selected', 'Please select at least one category (leaf categories only)')
      return
    }

    if (variantsParam.length === 0) {
      showNotification('warning', 'No variants added', 'Please add at least one variant (size, color, stock)')
      return
    }

    const stockPrice = parseFloat(formDataParam.stockPrice)
    const retailPrice = parseFloat(formDataParam.retailPrice)

    if (isNaN(stockPrice) || isNaN(retailPrice) || stockPrice <= 0 || retailPrice <= 0) {
      showNotification('warning', 'Invalid prices', 'Please enter valid prices')
      return
    }

    setIsSubmitting(true)

    try {
      if (isEditing && editingId) {
        // Update existing product
        const updates: Partial<Omit<Product, 'id' | 'createdAt' | 'updatedAt'>> = {
          name: formDataParam.name.trim(),
          description: formDataParam.description.trim(),
          brand: formDataParam.brand.trim(),
          gender: formDataParam.gender,
          stockPrice,
          retailPrice,
          sku: formDataParam.sku.trim(),
          images: formDataParam.images || [],
        }

        const result = await updateProductAction(editingId, updates)

        if (result.success) {
          // Assign product to selected categories
          await assignProductToCategoriesAction(editingId, formDataParam.categoryIds)

          // Refresh the products list
          const updatedProducts = products.map(p =>
            p.id === editingId
              ? { ...p, ...updates }
              : p
          )
          setProducts(updatedProducts)
          showNotification('success', 'Product updated successfully!')
          resetForm()
        } else {
          showNotification('error', 'Failed to update product', result.message || 'Failed to update product')
        }
      } else {
        // Create new product with variants
        // Auto-generate SKU if not provided (to avoid uniqueness constraint violations)
        const effectiveSku = formDataParam.sku.trim() || `SKU-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`

        const newProduct: Omit<Product, 'id' | 'createdAt' | 'updatedAt'> = {
          name: formDataParam.name.trim(),
          description: formDataParam.description.trim(),
          brand: formDataParam.brand.trim(),
          gender: formDataParam.gender,
          stockPrice,
          retailPrice,
          sku: effectiveSku,
          images: formDataParam.images || []
        }

        // Convert variants to the format expected by createProductAction
        const variantsToCreate = variantsParam.map(v => ({
          size: v.size,
          color: v.color,
          stockQuantity: v.stockQuantity,
          images: [] as string[]
        }))

        const result = await createProductAction(newProduct, variantsToCreate)

        if (result.success && result.data) {
          // Assign product to selected categories
          await assignProductToCategoriesAction(result.data.product.id, formDataParam.categoryIds)

          setProducts([result.data.product, ...products])
          showNotification('success', 'Product created successfully with variants!')
          resetForm()
        } else {
          showNotification('error', 'Failed to create product', result.message || 'Failed to create product')
        }
      }
    } catch (error) {
      console.error('Submit error:', error)
      showNotification('error', 'Submission error', 'An error occurred. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-black-900">Product Management</h1>
              <p className="mt-1 text-sm text-gray-600">
                Manage your product catalog
              </p>
            </div>
            <Link
              href={`/${locale}/admin/dashboard`}
              className="text-sm text-black-700 hover:text-black-800 font-medium"
            >
              ← Back to Dashboard
            </Link>
          </div>
          <button
            onClick={() => setIsDialogOpen(true)}
            className="mt-4 w-full sm:w-auto px-4 py-2 bg-black-700 text-white rounded-lg hover:bg-black-800 font-medium transition-colors flex items-center justify-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            Add Product
          </button>
        </div>
      </div>

      {/* Product Form Dialog */}
      <ProductFormDialog
        isOpen={isDialogOpen}
        onClose={() => {
          setIsDialogOpen(false)
          resetForm()
        }}
        onSubmit={handleSubmit}
        editingProduct={editingProduct}
        isEditing={isEditing}
        allBrands={allBrands}
        onOpenCategoryPicker={() => setShowFormCategoryPicker(true)}
        selectedCategoryIds={formData.categoryIds}
      />

      {/* Products List */}
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Products</h2>
          <p className="hidden sm:block text-xs text-gray-500 italic">Tap on table headers to sort</p>
        </div>

        {products.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 text-center py-12">
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
                d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
              />
            </svg>
            <h3 className="mt-2 text-sm font-medium text-gray-900">No products</h3>
            <p className="mt-1 text-sm text-gray-500">Get started by creating a new product.</p>
          </div>
        ) : (
          <>
            {/* Mobile Card View */}
            <div className="sm:hidden space-y-3">
              {sortedProducts.map((product) => {
                const totalStock = product.variants.reduce((sum, v) => sum + v.stockQuantity, 0)
                const firstImage = product.images?.[0]

                return (
                  <div
                    key={product.id}
                    className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden"
                  >
                    <div
                      className="p-3 cursor-pointer"
                      onClick={() => loadProductIntoForm(product)}
                    >
                      <div className="flex gap-3">
                        {/* Thumbnail */}
                        <div className="w-20 h-20 flex-shrink-0 rounded-lg overflow-hidden bg-gray-100">
                          {firstImage ? (
                            <Image
                              src={firstImage}
                              alt={product.name}
                              width={80}
                              height={80}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-gray-400 text-xs">
                              No Image
                            </div>
                          )}
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <h3 className="text-sm font-semibold text-gray-900 truncate">{product.name}</h3>
                          <p className="text-xs text-gray-500">{product.brand} &middot; {product.sku}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-700">
                              {product.category}
                            </span>
                            <span className="text-xs text-gray-500">{product.gender}</span>
                          </div>
                        </div>
                      </div>

                      {/* Details row */}
                      <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100">
                        <div>
                          <span className="text-sm font-semibold text-gray-900">Rs {product.stockPrice.toFixed(0)}</span>
                          <span className="text-xs text-gray-400 line-through ml-1">Rs {product.retailPrice.toFixed(0)}</span>
                        </div>
                        <div className="text-xs text-gray-500">
                          {product.variants.length} variants &middot; {product.variants.map(v => v.size).join(', ')}
                        </div>
                        <div className={`text-xs font-medium ${totalStock === 0 ? 'text-red-600' : totalStock < 10 ? 'text-black-600' : 'text-green-600'}`}>
                          {totalStock} units
                        </div>
                      </div>
                    </div>

                    {/* Actions row */}
                    <div className="flex items-center justify-between px-3 py-2 bg-gray-50 border-t border-gray-100">
                      <Link
                        href={`/${locale}/product/${product.id}`}
                        className="text-xs text-black-700 hover:text-black-800 font-medium flex items-center gap-1"
                        target="_blank"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                        View
                      </Link>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          loadProductIntoForm(product)
                        }}
                        className="text-xs text-gray-600 hover:text-gray-900 font-medium flex items-center gap-1"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                        Edit
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleOpenSectionDialog(product)
                        }}
                        className="text-xs text-black-600 hover:text-black-700 font-medium flex items-center gap-1"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                        </svg>
                        Sections
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleDelete(product.id, product.name)
                        }}
                        className="text-xs text-red-500 hover:text-red-700 font-medium flex items-center gap-1"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                        Delete
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Desktop Table View */}
            <div className="hidden sm:block bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th
                        onClick={() => handleSort('name')}
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
                      >
                        <div className="flex items-center gap-1">
                          Product
                          {sortBy === 'name' && (
                            <svg className={`w-4 h-4 transition-transform ${sortOrder === 'desc' ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                            </svg>
                          )}
                        </div>
                      </th>
                      <th
                        onClick={() => handleSort('category')}
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
                      >
                        <div className="flex items-center gap-1">
                          Category
                          {sortBy === 'category' && (
                            <svg className={`w-4 h-4 transition-transform ${sortOrder === 'desc' ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                            </svg>
                          )}
                        </div>
                      </th>
                      <th
                        onClick={() => handleSort('price')}
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
                      >
                        <div className="flex items-center gap-1">
                          Price
                          {sortBy === 'price' && (
                            <svg className={`w-4 h-4 transition-transform ${sortOrder === 'desc' ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                            </svg>
                          )}
                        </div>
                      </th>
                      <th
                        onClick={() => handleSort('variants')}
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
                      >
                        <div className="flex items-center gap-1">
                          Variants
                          {sortBy === 'variants' && (
                            <svg className={`w-4 h-4 transition-transform ${sortOrder === 'desc' ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                            </svg>
                          )}
                        </div>
                      </th>
                      <th
                        onClick={() => handleSort('stock')}
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
                      >
                        <div className="flex items-center gap-1">
                          Stock
                          {sortBy === 'stock' && (
                            <svg className={`w-4 h-4 transition-transform ${sortOrder === 'desc' ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                            </svg>
                          )}
                        </div>
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {sortedProducts.map((product) => {
                      const totalStock = product.variants.reduce((sum, v) => sum + v.stockQuantity, 0)
                      const firstImage = product.images?.[0]

                      return (
                        <tr
                          key={product.id}
                          onClick={() => loadProductIntoForm(product)}
                          className={`hover:bg-gray-100 cursor-pointer transition-colors ${
                            editingId === product.id ? 'bg-gray-100' : ''
                          }`}
                        >
                          <td className="px-6 py-4">
                            <div className="flex items-start">
                              <div className="h-16 w-16 flex-shrink-0 rounded-lg overflow-hidden bg-gray-100">
                                {firstImage ? (
                                  <Image
                                    src={firstImage}
                                    alt={product.name}
                                    width={64}
                                    height={64}
                                    className="h-full w-full object-cover"
                                  />
                                ) : (
                                  <div className="h-full w-full flex items-center justify-center text-gray-400 text-xs">
                                    No Image
                                  </div>
                                )}
                              </div>
                              <div className="ml-4 min-w-0 flex-1">
                                <div className="text-sm font-semibold text-gray-900 break-words">{product.name}</div>
                                <div className="text-sm text-gray-500">{product.brand}</div>
                                <div className="text-xs text-gray-400">{product.sku}</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900">{product.category}</div>
                            <div className="text-xs text-gray-500">{product.gender}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-semibold text-gray-900">Rs {product.stockPrice.toFixed(2)}</div>
                            <div className="text-xs text-gray-500 line-through">Rs {product.retailPrice.toFixed(2)}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900">{product.variants.length} variants</div>
                            <div className="text-xs text-gray-500">
                              {product.variants.map(v => v.size).join(', ')}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className={`text-sm font-medium ${totalStock === 0 ? 'text-red-600' : totalStock < 10 ? 'text-black-600' : 'text-green-600'}`}>
                              {totalStock} units
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                            <div className="flex items-center justify-end gap-2">
                              <Link
                                href={`/${locale}/product/${product.id}`}
                                className="text-black-700 hover:text-black-800 p-1"
                                target="_blank"
                                onClick={(e) => e.stopPropagation()}
                                title="View product"
                              >
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                </svg>
                              </Link>
                              <div className="relative">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    setOpenDropdownId(openDropdownId === product.id ? null : product.id)
                                  }}
                                  className="text-gray-600 hover:text-gray-900 p-1 hover:bg-gray-100 rounded"
                                  title="More options"
                                >
                                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                                    <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
                                  </svg>
                                </button>
                                {openDropdownId === product.id && (
                                  <div className="absolute right-0 mt-1 w-48 bg-white rounded-lg shadow-lg border border-gray-200 z-10">
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        handleOpenSectionDialog(product)
                                      }}
                                      className="w-full text-left px-4 py-2 hover:bg-gray-50 flex items-center gap-2 text-sm text-gray-700 rounded-lg"
                                    >
                                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                                      </svg>
                                      Add to Sections
                                    </button>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        setOpenDropdownId(null)
                                        handleDelete(product.id, product.name)
                                      }}
                                      className="w-full text-left px-4 py-2 hover:bg-red-50 flex items-center gap-2 text-sm text-red-600 rounded-lg"
                                    >
                                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                      </svg>
                                      Delete Product
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {/* Summary */}
        {products.length > 0 && (
          <div className="mt-6 flex items-center justify-between text-sm text-gray-600">
            <p>Showing {products.length} products</p>
            <p>Total stock: {products.reduce((sum, p) => sum + p.variants.reduce((vSum, v) => vSum + v.stockQuantity, 0), 0)} units</p>
          </div>
        )}
      </div>

      {/* Section Assignment Dialog */}
      {showSectionDialog && selectedProductForSection && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            {/* Dialog Header */}
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Add to Homepage Sections</h2>
                <p className="text-sm text-gray-600 mt-1">
                  Assign &quot;{selectedProductForSection.name}&quot; to promotional sections
                </p>
              </div>
              <button
                onClick={() => {
                  setShowSectionDialog(false)
                  setSectionQuantities({})
                  setSelectedProductForSection(null)
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Product Info */}
            <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
              <div className="flex items-center gap-4">
                <div className="relative w-20 h-20 bg-gray-100 rounded flex-shrink-0">
                  {selectedProductForSection.images?.[0] && (
                    <Image
                      src={selectedProductForSection.images[0]}
                      alt={selectedProductForSection.name}
                      fill
                      className="object-cover rounded"
                      sizes="80px"
                    />
                  )}
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">{selectedProductForSection.name}</h3>
                  <p className="text-sm text-gray-600">{selectedProductForSection.brand}</p>
                  <p className="text-sm font-medium text-green-600 mt-1">
                    Total Stock: {selectedProductForSection.variants.reduce((sum, v) => sum + v.stockQuantity, 0)} units
                  </p>
                </div>
              </div>
            </div>

            {/* Section List */}
            <div className="px-6 py-4">
              <h3 className="font-semibold text-gray-900 mb-4">Select Sections and Quantities</h3>
              {promotionalCategories.length === 0 ? (
                <p className="text-gray-500 text-center py-8">No promotional sections available</p>
              ) : (
                <div className="space-y-3">
                  {promotionalCategories.map((category) => (
                    <div
                      key={category.id}
                      className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:border-purple-300 transition-colors"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h4 className="font-semibold text-gray-900">{category.name}</h4>
                          <span
                            className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                              category.isActive
                                ? 'bg-green-100 text-green-700'
                                : 'bg-gray-100 text-gray-600'
                            }`}
                          >
                            {category.isActive ? 'Active' : 'Inactive'}
                          </span>
                        </div>
                        {category.description && (
                          <p className="text-sm text-gray-600 mt-1">{category.description}</p>
                        )}
                      </div>
                      <input
                        type="number"
                        min="0"
                        placeholder="0"
                        value={sectionQuantities[category.id] || ''}
                        onChange={(e) => {
                          const value = parseInt(e.target.value) || 0
                          setSectionQuantities({
                            ...sectionQuantities,
                            [category.id]: value,
                          })
                        }}
                        className="w-24 px-3 py-2 border border-gray-300 rounded-lg focus:border-black-500 focus:outline-none ml-4"
                      />
                    </div>
                  ))}
                </div>
              )}

              {/* Total Allocated Warning */}
              {Object.values(sectionQuantities).some((qty) => qty > 0) && (
                <div className="mt-4 p-3 bg-gray-100 border border-gray-200 rounded-lg">
                  <p className="text-sm text-black-800">
                    <strong>Total to allocate:</strong>{' '}
                    {Object.values(sectionQuantities).reduce((sum, qty) => sum + qty, 0)} units
                  </p>
                  <p className="text-xs text-black-600 mt-1">
                    Available stock: {selectedProductForSection.variants.reduce((sum, v) => sum + v.stockQuantity, 0)}{' '}
                    units
                  </p>
                </div>
              )}
            </div>

            {/* Dialog Footer */}
            <div className="sticky bottom-0 bg-white border-t border-gray-200 px-6 py-4 flex items-center justify-end gap-3">
              <button
                onClick={() => {
                  setShowSectionDialog(false)
                  setSectionQuantities({})
                  setSelectedProductForSection(null)
                }}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleAssignToSections}
                disabled={assigningSections || Object.values(sectionQuantities).every((qty) => !qty || qty === 0)}
                className="px-4 py-2 bg-black-700 text-white rounded-lg hover:bg-black-800 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {assigningSections ? 'Assigning...' : 'Assign to Sections'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Category Picker Dialog (for form - new/edit products) */}
      <CategoryPickerDialog
        isOpen={showFormCategoryPicker}
        onClose={() => setShowFormCategoryPicker(false)}
        onConfirm={(categoryIds) => {
          setFormData({ ...formData, categoryIds })
          setShowFormCategoryPicker(false)
        }}
        initialSelectedIds={formData.categoryIds}
      />

      {/* Notification */}
      <Notification
        type={notification.type}
        title={notification.title}
        message={notification.message}
        isOpen={notification.isOpen}
        onClose={closeNotification}
      />

      {/* Confirm Dialog */}
      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        title={confirmDialog.title}
        message={confirmDialog.message}
        onConfirm={confirmDialog.onConfirm}
        onCancel={() => setConfirmDialog({ ...confirmDialog, isOpen: false })}
      />
    </div>
  )
}
