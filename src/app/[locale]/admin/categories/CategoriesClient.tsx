'use client'

import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import {
  getCategoryTreeAction,
  createCategoryAction,
  updateCategoryAction,
  deleteCategoryAction,
  getCategoryStatisticsAction,
  findDuplicateNamesAction
} from '@/app/actions/categories'
import type { CategoryWithChildren, CategoryTree } from '@/lib/repositories/category.repository'
import ConfirmDialog from '@/components/ui/ConfirmDialog'

export default function CategoriesClient() {
  const [categoryTree, setCategoryTree] = useState<CategoryTree | null>(null)
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [selectedHierarchy, setSelectedHierarchy] = useState<'ladies' | 'gents' | 'kids'>('ladies')
  const [selectedParentId, setSelectedParentId] = useState<string | null>(null)
  const [newCategoryName, setNewCategoryName] = useState('')
  const [isFeatured, setIsFeatured] = useState(false)
  const [editingCategory, setEditingCategory] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')
  const [stats, setStats] = useState<any>(null)
  const [duplicates, setDuplicates] = useState<any[]>([])
  const [showStats, setShowStats] = useState(false)
  const [showDuplicates, setShowDuplicates] = useState(false)

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

  useEffect(() => {
    loadCategories()
  }, [])

  async function loadCategories() {
    setLoading(true)
    const result = await getCategoryTreeAction()
    if (result.success && result.data) {
      setCategoryTree(result.data)
    } else {
      toast.error('Failed to load categories')
    }
    setLoading(false)
  }

  async function loadStats() {
    const result = await getCategoryStatisticsAction()
    if (result.success) {
      setStats(result.data)
      setShowStats(true)
    }
  }

  async function loadDuplicates() {
    const result = await findDuplicateNamesAction()
    if (result.success) {
      setDuplicates(result.data || [])
      setShowDuplicates(true)
    }
  }

  async function handleCreateCategory() {
    if (!newCategoryName.trim()) {
      toast.error('Category name is required')
      return
    }

    const result = await createCategoryAction(
      newCategoryName,
      selectedHierarchy,
      selectedParentId,
      isFeatured
    )

    if (result.success) {
      toast.success('Category created successfully')
      setShowCreateModal(false)
      setNewCategoryName('')
      setSelectedParentId(null)
      setIsFeatured(false)
      loadCategories()
    } else {
      toast.error(result.message || 'Failed to create category')
    }
  }

  async function handleUpdateName(categoryId: string, newName: string) {
    const result = await updateCategoryAction(categoryId, { name: newName })
    if (result.success) {
      toast.success('Category updated')
      setEditingCategory(null)
      loadCategories()
    } else {
      toast.error(result.message || 'Failed to update category')
    }
  }

  async function handleToggleFeatured(categoryId: string, currentStatus: boolean) {
    const result = await updateCategoryAction(categoryId, {
      isFeatured: !currentStatus
    })
    if (result.success) {
      toast.success(
        !currentStatus ? 'Added to featured categories' : 'Removed from featured categories'
      )
      loadCategories()
    } else {
      toast.error(result.message || 'Failed to update category')
    }
  }

  async function handleToggleActive(categoryId: string, currentStatus: boolean) {
    const result = await updateCategoryAction(categoryId, {
      isActive: !currentStatus
    })
    if (result.success) {
      toast.success(currentStatus ? 'Category deactivated' : 'Category activated')
      loadCategories()
    } else {
      toast.error(result.message || 'Failed to update category')
    }
  }

  async function handleDeleteCategory(categoryId: string, categoryName: string) {
    setConfirmDialog({
      isOpen: true,
      title: 'Delete Category',
      message: `Are you sure you want to delete "${categoryName}"? This will only work if the category has no children and no products.`,
      onConfirm: async () => {
        setConfirmDialog({ ...confirmDialog, isOpen: false })

        const result = await deleteCategoryAction(categoryId)
        if (result.success) {
          toast.success('Category deleted')
          loadCategories()
        } else {
          toast.error(result.message || 'Failed to delete category')
        }
      }
    })
  }

  function openCreateModal(
    hierarchy: 'ladies' | 'gents' | 'kids',
    parentId: string | null = null
  ) {
    setSelectedHierarchy(hierarchy)
    setSelectedParentId(parentId)
    setShowCreateModal(true)
  }

  function renderCategory(category: CategoryWithChildren, hierarchy: 'ladies' | 'gents' | 'kids') {
    const isEditing = editingCategory === category.id

    return (
      <div key={category.id} className="ml-4 border-l-2 border-gray-200 pl-4 py-2">
        <div className="flex items-center gap-3 flex-wrap">
          {/* Category Name */}
          {isEditing ? (
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={editingName}
                onChange={e => setEditingName(e.target.value)}
                className="border rounded px-2 py-1 text-sm"
                autoFocus
              />
              <button
                onClick={() => handleUpdateName(category.id, editingName)}
                className="text-green-600 hover:text-green-800 text-sm"
              >
                Save
              </button>
              <button
                onClick={() => setEditingCategory(null)}
                className="text-gray-600 hover:text-black-700 text-sm"
              >
                Cancel
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <span className="font-medium">{category.name}</span>
              <button
                onClick={() => {
                  setEditingCategory(category.id)
                  setEditingName(category.name)
                }}
                className="text-black-600 hover:text-black-700 text-xs"
              >
                ✏️
              </button>
            </div>
          )}

          {/* Level Badge */}
          <span className="text-xs bg-gray-200 px-2 py-1 rounded">L{category.level}</span>

          {/* Product Count */}
          <span className="text-xs text-gray-600">
            {category.productCount || 0} products
          </span>

          {/* Featured Badge */}
          {category.isFeatured && (
            <span className="text-xs bg-gray-100 text-black-700 px-2 py-1 rounded">
              ⭐ Featured
            </span>
          )}

          {/* Active Status */}
          {!category.isActive && (
            <span className="text-xs bg-red-100 text-red-800 px-2 py-1 rounded">
              Inactive
            </span>
          )}

          {/* Actions */}
          <div className="flex items-center gap-2 ml-auto">
            <button
              onClick={() => handleToggleFeatured(category.id, category.isFeatured)}
              className="text-xs px-2 py-1 bg-gray-100 hover:bg-yellow-200 rounded"
              title={category.isFeatured ? 'Remove from featured' : 'Add to featured'}
            >
              {category.isFeatured ? '⭐' : '☆'}
            </button>

            <button
              onClick={() => handleToggleActive(category.id, category.isActive)}
              className={`text-xs px-2 py-1 rounded ${
                category.isActive
                  ? 'bg-green-100 hover:bg-green-200'
                  : 'bg-red-100 hover:bg-red-200'
              }`}
              title={category.isActive ? 'Deactivate' : 'Activate'}
            >
              {category.isActive ? 'Active' : 'Inactive'}
            </button>

            <button
              onClick={() => openCreateModal(hierarchy, category.id)}
              className="text-xs px-2 py-1 bg-gray-100 hover:bg-blue-200 rounded"
            >
              + Add Child
            </button>

            <button
              onClick={() => handleDeleteCategory(category.id, category.name)}
              className="text-xs px-2 py-1 bg-red-100 hover:bg-red-200 rounded"
            >
              🗑️
            </button>
          </div>
        </div>

        {/* Render Children */}
        {category.children && category.children.length > 0 && (
          <div className="mt-2">
            {category.children.map(child => renderCategory(child, hierarchy))}
          </div>
        )}
      </div>
    )
  }

  function renderHierarchy(
    title: string,
    hierarchy: 'ladies' | 'gents' | 'kids',
    categories: CategoryWithChildren[]
  ) {
    return (
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
          <h2 className="text-xl sm:text-2xl font-bold">{title}</h2>
          <button
            onClick={() => openCreateModal(hierarchy, null)}
            className="px-4 py-2 bg-primary text-white rounded hover:bg-primary/90 text-sm w-full sm:w-auto"
          >
            + Add Root Category
          </button>
        </div>

        {categories.length === 0 ? (
          <p className="text-gray-500">No categories in this hierarchy yet.</p>
        ) : (
          <div>{categories.map(cat => renderCategory(cat, hierarchy))}</div>
        )}
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Loading categories...</div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold">Category Management</h1>
        <div className="flex gap-3">
          <button
            onClick={loadStats}
            className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded text-sm"
          >
            📊 Statistics
          </button>
          <button
            onClick={loadDuplicates}
            className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded text-sm"
          >
            🔍 Find Duplicates
          </button>
        </div>
      </div>

      {/* Statistics Panel */}
      {showStats && stats && (
        <div className="bg-gray-100 rounded-lg p-6 mb-6">
          <div className="flex justify-between items-start">
            <div>
              <h3 className="text-xl font-bold mb-4">Category Statistics</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <div className="text-2xl font-bold">{stats.totalCategories}</div>
                  <div className="text-sm text-gray-600">Total Categories</div>
                </div>
                <div>
                  <div className="text-2xl font-bold">{stats.categoriesByHierarchy.ladies}</div>
                  <div className="text-sm text-gray-600">Ladies</div>
                </div>
                <div>
                  <div className="text-2xl font-bold">{stats.categoriesByHierarchy.gents}</div>
                  <div className="text-sm text-gray-600">Gents</div>
                </div>
                <div>
                  <div className="text-2xl font-bold">{stats.categoriesByHierarchy.kids}</div>
                  <div className="text-sm text-gray-600">Kids</div>
                </div>
                <div>
                  <div className="text-2xl font-bold">{stats.featuredCount}</div>
                  <div className="text-sm text-gray-600">Featured</div>
                </div>
                <div>
                  <div className="text-2xl font-bold">{stats.categoriesWithProducts}</div>
                  <div className="text-sm text-gray-600">With Products</div>
                </div>
              </div>
            </div>
            <button
              onClick={() => setShowStats(false)}
              className="text-gray-500 hover:text-gray-700"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Duplicates Panel */}
      {showDuplicates && (
        <div className="bg-yellow-50 rounded-lg p-6 mb-6">
          <div className="flex justify-between items-start">
            <div className="flex-1">
              <h3 className="text-xl font-bold mb-4">
                Duplicate Category Names ({duplicates.length})
              </h3>
              {duplicates.length === 0 ? (
                <p className="text-gray-600">No duplicate names found!</p>
              ) : (
                <div className="space-y-3">
                  {duplicates.map((dup, idx) => (
                    <div key={idx} className="bg-white p-3 rounded">
                      <div className="font-semibold">{dup.name}</div>
                      <div className="text-sm text-gray-600 mt-1">
                        Found in:
                        {dup.categories.map((cat: any) => (
                          <span
                            key={cat.id}
                            className="ml-2 px-2 py-1 bg-gray-100 rounded text-xs"
                          >
                            {cat.hierarchy} (L{cat.level})
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <button
              onClick={() => setShowDuplicates(false)}
              className="text-gray-500 hover:text-gray-700 ml-4"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Category Trees */}
      {categoryTree && (
        <>
          {renderHierarchy('👗 Ladies', 'ladies', categoryTree.ladies)}
          {renderHierarchy('👔 Gents', 'gents', categoryTree.gents)}
          {renderHierarchy('👶 Kids', 'kids', categoryTree.kids)}
        </>
      )}

      {/* Create Category Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-xl font-bold mb-4">Create New Category</h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Hierarchy</label>
                <select
                  value={selectedHierarchy}
                  onChange={e =>
                    setSelectedHierarchy(e.target.value as 'ladies' | 'gents' | 'kids')
                  }
                  className="w-full border rounded px-3 py-2"
                  disabled={selectedParentId !== null}
                >
                  <option value="ladies">Ladies</option>
                  <option value="gents">Gents</option>
                  <option value="kids">Kids</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Category Name</label>
                <input
                  type="text"
                  value={newCategoryName}
                  onChange={e => setNewCategoryName(e.target.value)}
                  className="w-full border rounded px-3 py-2"
                  placeholder="e.g., Shirts, Dresses, Toys"
                  autoFocus
                />
              </div>

              <div>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={isFeatured}
                    onChange={e => setIsFeatured(e.target.checked)}
                    className="rounded"
                  />
                  <span className="text-sm">Featured (show on homepage)</span>
                </label>
              </div>

              {selectedParentId && (
                <div className="text-sm text-gray-600">
                  This will be created as a child category.
                </div>
              )}
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={handleCreateCategory}
                className="flex-1 px-4 py-2 bg-primary text-white rounded hover:bg-primary/90"
              >
                Create Category
              </button>
              <button
                onClick={() => {
                  setShowCreateModal(false)
                  setNewCategoryName('')
                  setSelectedParentId(null)
                  setIsFeatured(false)
                }}
                className="flex-1 px-4 py-2 bg-gray-200 rounded hover:bg-gray-300"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

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
