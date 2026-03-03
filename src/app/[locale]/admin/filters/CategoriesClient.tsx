'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useLocale } from 'next-intl'
import type { CategoryWithChildren, CategoryTree } from '@/lib/repositories/category.repository'
import {
  createCategoryAction,
  updateCategoryAction,
  deleteCategoryAction,
  getCategoryTreeAction,
  getCategoryProductsAction,
  getUnassignedProductsAction,
  addProductToCategoryAction,
  removeProductFromCategoryAction,
} from '@/app/actions/categories'
import Notification, { type NotificationType } from '@/components/ui/Notification'
import ConfirmDialog from '@/components/ui/ConfirmDialog'

interface ProductWithVariants {
  id: string
  name: string
  brand: string
  imageUrl?: string
  variants?: any[]
}

interface CategoriesClientProps {
  initialCategories: CategoryTree
}

export default function CategoriesClient({ initialCategories }: CategoriesClientProps) {
  const locale = useLocale()
  const [categoryTree, setCategoryTree] = useState<CategoryTree>(initialCategories)

  // Flatten tree to array for easier processing
  const categories = Object.values(categoryTree).flat()
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [newCategoryName, setNewCategoryName] = useState('')
  const [selectedParentId, setSelectedParentId] = useState<string | null>(null)
  const [editingCategory, setEditingCategory] = useState<{ id: string; name: string } | null>(null)
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set())
  const [showOnlyFeatured, setShowOnlyFeatured] = useState(false)

  // Product management state
  const [showProductsModal, setShowProductsModal] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState<CategoryWithChildren | null>(null)
  const [categoryProducts, setCategoryProducts] = useState<ProductWithVariants[]>([])
  const [unassignedProducts, setUnassignedProducts] = useState<ProductWithVariants[]>([])
  const [loadingProducts, setLoadingProducts] = useState(false)
  const [showAddProductsSection, setShowAddProductsSection] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

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

  const refreshCategories = async () => {
    const result = await getCategoryTreeAction()
    if (result.success && result.data) {
      setCategoryTree(result.data)
    }
  }

  const handleViewProducts = async (category: CategoryWithChildren) => {
    setSelectedCategory(category)
    setShowProductsModal(true)
    setShowAddProductsSection(false)
    setSearchQuery('')
    setLoadingProducts(true)

    // Load products for this category
    const productsResult = await getCategoryProductsAction(category.id)
    if (productsResult.success && productsResult.data) {
      setCategoryProducts(productsResult.data)
    } else {
      showNotification('error', 'Error', 'Failed to load products')
      setCategoryProducts([])
    }

    setLoadingProducts(false)
  }

  const handleLoadUnassignedProducts = async () => {
    if (!selectedCategory) return

    setShowAddProductsSection(true)
    setLoadingProducts(true)

    const result = await getUnassignedProductsAction(selectedCategory.id)
    if (result.success && result.data) {
      setUnassignedProducts(result.data)
    } else {
      showNotification('error', 'Error', 'Failed to load products')
      setUnassignedProducts([])
    }

    setLoadingProducts(false)
  }

  const handleAddProductToCategory = async (productId: string) => {
    if (!selectedCategory) return

    const result = await addProductToCategoryAction(productId, selectedCategory.id)
    if (result.success) {
      showNotification('success', 'Success', 'Product added to category')
      // Refresh both lists
      await handleViewProducts(selectedCategory)
      if (showAddProductsSection) {
        const unassignedResult = await getUnassignedProductsAction(selectedCategory.id)
        if (unassignedResult.success && unassignedResult.data) {
          setUnassignedProducts(unassignedResult.data)
        }
      }
      await refreshCategories()
    } else {
      showNotification('error', 'Error', result.message || 'Failed to add product')
    }
  }

  const handleRemoveProductFromCategory = (productId: string, productName: string) => {
    if (!selectedCategory) return

    setConfirmDialog({
      isOpen: true,
      title: 'Remove Product',
      message: `Are you sure you want to remove "${productName}" from "${selectedCategory.name}"?`,
      onConfirm: async () => {
        setConfirmDialog(prev => ({ ...prev, isOpen: false }))
        const result = await removeProductFromCategoryAction(productId, selectedCategory.id)
        if (result.success) {
          showNotification('success', 'Success', 'Product removed from category')
          // Refresh products list
          await handleViewProducts(selectedCategory)
          await refreshCategories()
        } else {
          showNotification('error', 'Error', 'Failed to remove product')
        }
      },
    })
  }

  const closeProductsModal = () => {
    setShowProductsModal(false)
    setSelectedCategory(null)
    setCategoryProducts([])
    setUnassignedProducts([])
    setShowAddProductsSection(false)
    setSearchQuery('')
  }

  const handleCreateCategory = async () => {
    if (!newCategoryName.trim()) {
      showNotification('error', 'Validation Error', 'Please enter a category name')
      return
    }

    // Determine which hierarchy to use
    let hierarchyToUse: string

    if (selectedParentId) {
      // For child categories, get the parent's hierarchy
      const parent = flattenCategories(categories).find(c => c.id === selectedParentId)
      if (!parent) {
        showNotification('error', 'Error', 'Parent category not found')
        return
      }
      hierarchyToUse = parent.hierarchy
    } else {
      // For root categories, use the category name as the hierarchy
      hierarchyToUse = newCategoryName.toLowerCase().trim()
    }

    const result = await createCategoryAction(
      newCategoryName,
      hierarchyToUse as any,
      selectedParentId,
      false
    )
    if (result.success) {
      showNotification('success', 'Success', 'Category created successfully')
      setNewCategoryName('')
      setSelectedParentId(null)
      setShowCreateModal(false)
      await refreshCategories()
    } else {
      showNotification('error', 'Error', result.message || 'Failed to create category')
    }
  }

  const handleUpdateCategory = async (categoryId: string, name: string, isActive: boolean) => {
    const result = await updateCategoryAction(categoryId, { name, isActive })
    if (result.success) {
      showNotification('success', 'Success', 'Category updated successfully')
      setEditingCategory(null)
      await refreshCategories()
    } else {
      showNotification('error', 'Error', result.message || 'Failed to update category')
    }
  }

  const handleToggleFeatured = async (categoryId: string, currentFeatured: boolean) => {
    const result = await updateCategoryAction(categoryId, { isFeatured: !currentFeatured })
    if (result.success) {
      await refreshCategories()
      showNotification('success', 'Success', `Category ${!currentFeatured ? 'marked as featured' : 'removed from featured'}`)
    } else {
      showNotification('error', 'Error', result.message || 'Failed to update featured status')
    }
  }

  const handleDeleteCategory = (categoryId: string, categoryName: string) => {
    setConfirmDialog({
      isOpen: true,
      title: 'Delete Category',
      message: `Are you sure you want to delete "${categoryName}"? This will also delete all child categories.`,
      onConfirm: async () => {
        setConfirmDialog(prev => ({ ...prev, isOpen: false }))
        const result = await deleteCategoryAction(categoryId)
        if (result.success) {
          showNotification('success', 'Success', 'Category deleted successfully')
          await refreshCategories()
        } else {
          showNotification('error', 'Error', result.message || 'Failed to delete category')
        }
      },
    })
  }

  const toggleExpand = (categoryId: string) => {
    const newExpanded = new Set(expandedCategories)
    if (newExpanded.has(categoryId)) {
      newExpanded.delete(categoryId)
    } else {
      newExpanded.add(categoryId)
    }
    setExpandedCategories(newExpanded)
  }

  // Flatten the category tree into a single array
  const flattenCategories = (categories: CategoryWithChildren[]): CategoryWithChildren[] => {
    const result: CategoryWithChildren[] = []
    const flatten = (categoryList: CategoryWithChildren[]) => {
      categoryList.forEach(category => {
        result.push(category)
        if (category.children && category.children.length > 0) {
          flatten(category.children)
        }
      })
    }
    flatten(categories)
    return result
  }

  // Filter the tree based on featured status
  const filterTree = (categories: CategoryWithChildren[]): CategoryWithChildren[] => {
    if (!showOnlyFeatured) return categories

    return categories
      .map(category => ({
        ...category,
        children: filterTree(category.children)
      }))
      .filter(category => category.isFeatured || category.children.length > 0)
  }

  const filteredCategories = filterTree(categories)

  const renderCategory = (category: CategoryWithChildren, depth: number = 0) => {
    const hasChildren = category.children && category.children.length > 0
    const isExpanded = expandedCategories.has(category.id)
    const isEditing = editingCategory?.id === category.id

    return (
      <div key={category.id} className="border-l-2 border-gray-200">
        {/* Desktop Layout */}
        <div
          className="hidden sm:flex items-center gap-3 p-3 hover:bg-gray-50 group"
          style={{ paddingLeft: `${depth * 24 + 12}px` }}
        >
          {/* Expand/Collapse Button */}
          {hasChildren ? (
            <button
              onClick={() => toggleExpand(category.id)}
              className="w-5 h-5 flex items-center justify-center text-gray-500 hover:text-gray-700"
            >
              <svg
                className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          ) : (
            <div className="w-5 h-5" />
          )}

          {/* Category Name */}
          {isEditing ? (
            <input
              type="text"
              value={editingCategory.name}
              onChange={(e) => setEditingCategory({ ...editingCategory, name: e.target.value })}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleUpdateCategory(category.id, editingCategory.name, category.isActive)
                } else if (e.key === 'Escape') {
                  setEditingCategory(null)
                }
              }}
              className="flex-1 px-2 py-1 border border-black-500 rounded focus:outline-none focus:ring-2 focus:ring-black-500"
              autoFocus
            />
          ) : (
            <div className="flex-1 flex items-center gap-2">
              <span className={`font-medium ${category.isActive ? 'text-black-700' : 'text-gray-400'}`}>
                {category.name}
              </span>
              {category.isFeatured && (
                <svg className="w-4 h-4 text-black-500 fill-current" viewBox="0 0 20 20">
                  <path d="M10 15l-5.878 3.09 1.123-6.545L.489 6.91l6.572-.955L10 0l2.939 5.955 6.572.955-4.756 4.635 1.123 6.545z"/>
                </svg>
              )}
            </div>
          )}

          {/* Hierarchy Badge */}
          <span className={`text-xs px-2 py-1 rounded font-medium ${
            category.hierarchy === 'ladies' ? 'bg-gray-100 text-black-700' :
            category.hierarchy === 'gents' ? 'bg-gray-100 text-black-700' :
            'bg-gray-100 text-black-700'
          }`}>
            {category.hierarchy.charAt(0).toUpperCase() + category.hierarchy.slice(1)}
          </span>

          {/* Level Badge */}
          <span className="text-xs px-2 py-1 bg-gray-100 text-gray-600 rounded">
            L{category.level}
          </span>

          {/* Product Count */}
          {category.productCount !== undefined && category.productCount > 0 && (
            <span className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded font-medium">
              {category.productCount} products
            </span>
          )}

          {/* Featured Toggle */}
          <button
            onClick={() => handleToggleFeatured(category.id, category.isFeatured)}
            className={`text-xs px-2 py-1 rounded ${
              category.isFeatured
                ? 'bg-gray-100 text-black-700'
                : 'bg-gray-100 text-gray-500'
            }`}
            title={category.isFeatured ? 'Featured' : 'Not Featured'}
          >
            {category.isFeatured ? 'Featured' : 'Hidden'}
          </button>

          {/* Active Toggle */}
          <button
            onClick={() => handleUpdateCategory(category.id, category.name, !category.isActive)}
            className={`text-xs px-2 py-1 rounded ${
              category.isActive
                ? 'bg-green-100 text-green-700'
                : 'bg-gray-100 text-gray-500'
            }`}
          >
            {category.isActive ? 'Active' : 'Inactive'}
          </button>

          {/* Actions */}
          <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
            {isEditing ? (
              <>
                <button
                  onClick={() => handleUpdateCategory(category.id, editingCategory.name, category.isActive)}
                  className="text-green-600 hover:text-green-700 p-1"
                  title="Save"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </button>
                <button
                  onClick={() => setEditingCategory(null)}
                  className="text-gray-600 hover:text-gray-700 p-1"
                  title="Cancel"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => handleViewProducts(category)}
                  className="text-black-600 hover:text-black-700 p-1"
                  title="View Products"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                  </svg>
                </button>
                <button
                  onClick={() => {
                    setSelectedParentId(category.id)
                    setShowCreateModal(true)
                  }}
                  className="text-black-600 hover:text-black-700 p-1"
                  title="Add child category"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                </button>
                <button
                  onClick={() => setEditingCategory({ id: category.id, name: category.name })}
                  className="text-gray-600 hover:text-gray-700 p-1"
                  title="Edit"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                  </svg>
                </button>
                <button
                  onClick={() => handleDeleteCategory(category.id, category.name)}
                  className="text-red-600 hover:text-red-700 p-1"
                  title="Delete"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </>
            )}
          </div>
        </div>

        {/* Mobile Layout */}
        <div
          className="sm:hidden p-3"
          style={{ paddingLeft: `${depth * 16 + 8}px` }}
        >
          <div className="bg-white rounded-lg border border-gray-100 shadow-sm p-3">
            {/* Top Row: expand + name */}
            <div className="flex items-center gap-2">
              {hasChildren ? (
                <button
                  onClick={() => toggleExpand(category.id)}
                  className="w-6 h-6 flex items-center justify-center text-gray-500"
                >
                  <svg
                    className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              ) : (
                <div className="w-6 h-6 flex items-center justify-center">
                  <div className="w-1.5 h-1.5 rounded-full bg-gray-300" />
                </div>
              )}

              {isEditing ? (
                <input
                  type="text"
                  value={editingCategory.name}
                  onChange={(e) => setEditingCategory({ ...editingCategory, name: e.target.value })}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleUpdateCategory(category.id, editingCategory.name, category.isActive)
                    } else if (e.key === 'Escape') {
                      setEditingCategory(null)
                    }
                  }}
                  className="flex-1 px-2 py-1 border border-black-500 rounded text-sm focus:outline-none focus:ring-2 focus:ring-black-500"
                  autoFocus
                />
              ) : (
                <span className={`flex-1 font-medium text-sm ${category.isActive ? 'text-black-700' : 'text-gray-400'}`}>
                  {category.name}
                  {category.isFeatured && (
                    <svg className="w-3.5 h-3.5 text-black-500 fill-current inline ml-1" viewBox="0 0 20 20">
                      <path d="M10 15l-5.878 3.09 1.123-6.545L.489 6.91l6.572-.955L10 0l2.939 5.955 6.572.955-4.756 4.635 1.123 6.545z"/>
                    </svg>
                  )}
                </span>
              )}
            </div>

            {/* Badges Row */}
            <div className="flex flex-wrap gap-1.5 mt-2 ml-8">
              <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                category.hierarchy === 'ladies' ? 'bg-gray-100 text-black-700' :
                category.hierarchy === 'gents' ? 'bg-gray-100 text-black-700' :
                'bg-gray-100 text-black-700'
              }`}>
                {category.hierarchy.charAt(0).toUpperCase() + category.hierarchy.slice(1)}
              </span>
              <span className="text-[10px] px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded">
                L{category.level}
              </span>
              {category.productCount !== undefined && category.productCount > 0 && (
                <span className="text-[10px] px-1.5 py-0.5 bg-green-100 text-green-700 rounded font-medium">
                  {category.productCount} products
                </span>
              )}
              <button
                onClick={() => handleToggleFeatured(category.id, category.isFeatured)}
                className={`text-[10px] px-1.5 py-0.5 rounded ${
                  category.isFeatured
                    ? 'bg-gray-100 text-black-700'
                    : 'bg-gray-100 text-gray-500'
                }`}
              >
                {category.isFeatured ? 'Featured' : 'Hidden'}
              </button>
              <button
                onClick={() => handleUpdateCategory(category.id, category.name, !category.isActive)}
                className={`text-[10px] px-1.5 py-0.5 rounded ${
                  category.isActive
                    ? 'bg-green-100 text-green-700'
                    : 'bg-gray-100 text-gray-500'
                }`}
              >
                {category.isActive ? 'Active' : 'Inactive'}
              </button>
            </div>

            {/* Actions Row */}
            <div className="flex items-center gap-3 mt-2 ml-8 pt-2 border-t border-gray-100">
              {isEditing ? (
                <>
                  <button
                    onClick={() => handleUpdateCategory(category.id, editingCategory.name, category.isActive)}
                    className="text-green-600 text-xs font-medium"
                  >
                    Save
                  </button>
                  <button
                    onClick={() => setEditingCategory(null)}
                    className="text-gray-600 text-xs font-medium"
                  >
                    Cancel
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => handleViewProducts(category)}
                    className="text-black-600 text-xs font-medium"
                  >
                    Products
                  </button>
                  <button
                    onClick={() => {
                      setSelectedParentId(category.id)
                      setShowCreateModal(true)
                    }}
                    className="text-black-600 text-xs font-medium"
                  >
                    + Child
                  </button>
                  <button
                    onClick={() => setEditingCategory({ id: category.id, name: category.name })}
                    className="text-gray-600 text-xs font-medium"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDeleteCategory(category.id, category.name)}
                    className="text-red-600 text-xs font-medium"
                  >
                    Delete
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Render children */}
        {hasChildren && isExpanded && (
          <div>
            {category.children.map((child) => renderCategory(child, depth + 1))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-black-700">Categories</h1>
              <p className="mt-1 text-sm text-gray-600">
                Manage your product category hierarchy
              </p>
            </div>
            <Link
              href={`/${locale}/admin/dashboard`}
              className="text-sm text-black-700 hover:text-black-700 font-medium flex-shrink-0"
            >
              ← Back to Dashboard
            </Link>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              onClick={() => setShowOnlyFeatured(!showOnlyFeatured)}
              className={`px-4 py-2 rounded-lg transition-colors font-medium text-sm ${
                showOnlyFeatured
                  ? 'bg-gray-100 text-black-700'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {showOnlyFeatured ? 'Show All' : 'Featured Only'}
            </button>
            <button
              onClick={() => {
                setSelectedParentId(null)
                setShowCreateModal(true)
              }}
              className="px-4 py-2 bg-black-700 text-white rounded-lg hover:bg-black-800 transition-colors font-medium text-sm"
            >
              + New Category
            </button>
            <Link
              href={`/${locale}/admin/dashboard`}
              className="px-4 py-2 text-sm text-black-700 hover:text-black-700 font-medium sm:hidden"
            >
              ← Dashboard
            </Link>
          </div>
        </div>
      </div>

      {/* Categories Tree */}
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          {filteredCategories.length === 0 ? (
            <div className="p-12 text-center">
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
                  d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"
                />
              </svg>
              <h3 className="mt-2 text-sm font-medium text-black-700">
                {showOnlyFeatured ? 'No featured categories' : 'No categories'}
              </h3>
              <p className="mt-1 text-sm text-gray-500">
                {showOnlyFeatured
                  ? 'Mark some categories as featured to see them here'
                  : 'Get started by creating a new root category'
                }
              </p>
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {filteredCategories.map((category) => renderCategory(category))}
            </div>
          )}
        </div>
      </div>

      {/* Create Category Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <h2 className="text-xl font-bold text-black-700 mb-4">
              Create Category
            </h2>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Category Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleCreateCategory()
                  } else if (e.key === 'Escape') {
                    setShowCreateModal(false)
                    setNewCategoryName('')
                    setSelectedParentId(null)
                  }
                }}
                placeholder="e.g., Tops, Bottoms, Shoes"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black-500"
                autoFocus
              />
            </div>

            {!selectedParentId && (
              <div className="mb-4">
                <p className="text-sm text-gray-600">
                  This will create a new root hierarchy: <span className="font-medium">
                    {newCategoryName.toLowerCase().trim() || '(enter a name)'}
                  </span>
                </p>
              </div>
            )}

            {selectedParentId && (
              <div className="mb-4">
                <p className="text-sm text-gray-600">
                  Creating subcategory under: <span className="font-medium">
                    {flattenCategories(categories).find(c => c.id === selectedParentId)?.name}
                  </span>
                </p>
              </div>
            )}

            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowCreateModal(false)
                  setNewCategoryName('')
                  setSelectedParentId(null)
                }}
                className="px-4 py-2 text-gray-700 hover:text-black-700 font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateCategory}
                className="px-4 py-2 bg-black-700 text-white rounded-lg hover:bg-black-800 transition-colors font-medium"
              >
                Create Category
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Products Modal */}
      {showProductsModal && selectedCategory && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-5xl w-full max-h-[90vh] flex flex-col">
            {/* Header */}
            <div className="px-6 py-4 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-black-700">
                    Products in &ldquo;{selectedCategory.name}&rdquo;
                  </h2>
                  <p className="text-sm text-gray-600 mt-1">
                    Manage products assigned to this category
                  </p>
                </div>
                <button
                  onClick={closeProductsModal}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto px-6 py-4">
              {loadingProducts ? (
                <div className="flex items-center justify-center py-12">
                  <div className="text-gray-500">Loading products...</div>
                </div>
              ) : (
                <>
                  {/* Assigned Products */}
                  <div className="mb-6">
                    <h3 className="text-lg font-semibold text-black-700 mb-3">
                      Assigned Products ({categoryProducts.length})
                    </h3>
                    {categoryProducts.length === 0 ? (
                      <div className="text-center py-8 text-gray-500 bg-gray-50 rounded-lg">
                        No products assigned to this category yet
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 gap-3">
                        {categoryProducts.map(product => (
                          <div
                            key={product.id}
                            className="flex items-center gap-4 p-3 border border-gray-200 rounded-lg hover:bg-gray-50"
                          >
                            {product.imageUrl && (
                              <img
                                src={product.imageUrl}
                                alt={product.name}
                                className="w-16 h-16 object-cover rounded"
                              />
                            )}
                            <div className="flex-1">
                              <h4 className="font-medium text-black-700">{product.name}</h4>
                              <p className="text-sm text-gray-600">{product.brand}</p>
                              {product.variants && product.variants.length > 0 && (
                                <p className="text-xs text-gray-500 mt-1">
                                  {product.variants.length} variants
                                </p>
                              )}
                            </div>
                            <button
                              onClick={() => handleRemoveProductFromCategory(product.id, product.name)}
                              className="px-3 py-1.5 text-sm text-red-600 hover:text-red-700 border border-red-300 rounded-lg hover:bg-red-50 transition-colors"
                            >
                              Remove
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Add Products Section */}
                  {!showAddProductsSection ? (
                    <button
                      onClick={handleLoadUnassignedProducts}
                      className="w-full px-4 py-3 text-black-600 border-2 border-dashed border-blue-300 rounded-lg hover:bg-gray-100 transition-colors font-medium"
                    >
                      + Add Products to Category
                    </button>
                  ) : (
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="text-lg font-semibold text-black-700">
                          Available Products ({unassignedProducts.filter(p =>
                            p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            p.brand.toLowerCase().includes(searchQuery.toLowerCase())
                          ).length})
                        </h3>
                        <button
                          onClick={() => {
                            setShowAddProductsSection(false)
                            setSearchQuery('')
                          }}
                          className="text-sm text-gray-600 hover:text-black-700"
                        >
                          Cancel
                        </button>
                      </div>

                      {/* Search */}
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search products..."
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg mb-3 focus:outline-none focus:ring-2 focus:ring-black-500"
                      />

                      {/* Unassigned Products */}
                      <div className="grid grid-cols-1 gap-3 max-h-96 overflow-y-auto">
                        {unassignedProducts
                          .filter(p =>
                            p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            p.brand.toLowerCase().includes(searchQuery.toLowerCase())
                          )
                          .map(product => (
                            <div
                              key={product.id}
                              className="flex items-center gap-4 p-3 border border-gray-200 rounded-lg hover:bg-gray-50"
                            >
                              {product.imageUrl && (
                                <img
                                  src={product.imageUrl}
                                  alt={product.name}
                                  className="w-16 h-16 object-cover rounded"
                                />
                              )}
                              <div className="flex-1">
                                <h4 className="font-medium text-black-700">{product.name}</h4>
                                <p className="text-sm text-gray-600">{product.brand}</p>
                                {product.variants && product.variants.length > 0 && (
                                  <p className="text-xs text-gray-500 mt-1">
                                    {product.variants.length} variants
                                  </p>
                                )}
                              </div>
                              <button
                                onClick={() => handleAddProductToCategory(product.id)}
                                className="px-3 py-1.5 text-sm text-green-600 hover:text-green-700 border border-green-300 rounded-lg hover:bg-green-50 transition-colors"
                              >
                                Add
                              </button>
                            </div>
                          ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-gray-200">
              <button
                onClick={closeProductsModal}
                className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors font-medium"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Notification */}
      <Notification
        isOpen={notification.isOpen}
        type={notification.type}
        title={notification.title}
        message={notification.message}
        onClose={closeNotification}
      />

      {/* Confirm Dialog */}
      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        title={confirmDialog.title}
        message={confirmDialog.message}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        type="danger"
        onConfirm={confirmDialog.onConfirm}
        onCancel={() => setConfirmDialog(prev => ({ ...prev, isOpen: false }))}
      />
    </div>
  )
}
