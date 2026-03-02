'use client'

import { useState, useEffect } from 'react'
import type { Category } from '@/lib/repositories/category.repository'
import {
  getRootCategoriesAction,
  getChildCategoriesAction,
  getCategoryTreeAction,
} from '@/app/actions/categories'

interface CategoryPickerDialogProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: (selectedCategoryIds: string[]) => void
  initialSelectedIds?: string[]
}

interface CategoryTreeItem extends Category {
  children?: CategoryTreeItem[]
}

interface BreadcrumbItem {
  id: string | null
  name: string
}

export default function CategoryPickerDialog({
  isOpen,
  onClose,
  onConfirm,
  initialSelectedIds = [],
}: CategoryPickerDialogProps) {
  const [categoryTree, setCategoryTree] = useState<CategoryTreeItem[]>([])
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set())
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<Set<string>>(
    new Set(initialSelectedIds)
  )
  const [loading, setLoading] = useState(false)

  // Load full category tree initially
  useEffect(() => {
    if (isOpen) {
      loadCategoryTree()
    }
  }, [isOpen])

  const loadCategoryTree = async () => {
    setLoading(true)
    const result = await getCategoryTreeAction()
    if (result.success && result.data) {
      // getCategoryTreeAction returns dynamic hierarchies
      const tree = Object.values(result.data).flat()
      setCategoryTree(tree as CategoryTreeItem[])
    }
    setLoading(false)
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

  const toggleCategory = (category: CategoryTreeItem) => {
    // Only allow selection of leaf categories (no children)
    if (category.children && category.children.length > 0) {
      // This is not a leaf - just expand it
      toggleExpand(category.id)
      return
    }

    // This is a leaf category - allow selection
    const newSelected = new Set(selectedCategoryIds)
    if (newSelected.has(category.id)) {
      newSelected.delete(category.id)
    } else {
      newSelected.add(category.id)
    }
    setSelectedCategoryIds(newSelected)
  }

  const handleConfirm = () => {
    onConfirm(Array.from(selectedCategoryIds))
    onClose()
  }

  const handleCancel = () => {
    setSelectedCategoryIds(new Set(initialSelectedIds))
    onClose()
  }

  const getHierarchyColor = (hierarchy: string) => {
    switch (hierarchy) {
      case 'ladies':
        return 'text-black-600 bg-gray-100'
      case 'gents':
        return 'text-black-600 bg-gray-100'
      case 'kids':
        return 'text-green-600 bg-green-50'
      default:
        return 'text-gray-600 bg-gray-50'
    }
  }

  const renderCategoryTree = (categories: CategoryTreeItem[], depth = 0) => {
    return categories.map(category => {
      const isExpanded = expandedCategories.has(category.id)
      const isSelected = selectedCategoryIds.has(category.id)
      const hasChildren = category.children && category.children.length > 0
      const isLeaf = !hasChildren

      return (
        <div key={category.id} style={{ marginLeft: `${depth * 20}px` }}>
          <div
            className={`flex items-center gap-2 py-2 px-3 rounded cursor-pointer hover:bg-gray-100 ${
              isSelected ? 'bg-indigo-50 border-l-4 border-black-600' : ''
            }`}
            onClick={() => toggleCategory(category)}
          >
            {/* Expand/Collapse Icon */}
            {hasChildren && (
              <span className="text-gray-500 text-sm w-4">
                {isExpanded ? '▼' : '▶'}
              </span>
            )}
            {isLeaf && <span className="w-4" />}

            {/* Checkbox for leaf categories */}
            {isLeaf && (
              <input
                type="checkbox"
                checked={isSelected}
                onChange={() => toggleCategory(category)}
                onClick={(e) => e.stopPropagation()}
                className="rounded border-gray-300 text-black-700 focus:ring-indigo-500"
              />
            )}

            {/* Category Name */}
            <span className={`font-medium ${isLeaf ? '' : 'font-bold'}`}>
              {category.name}
            </span>

            {/* Hierarchy Badge */}
            <span className={`text-xs px-2 py-0.5 rounded ${getHierarchyColor(category.hierarchy)}`}>
              {category.hierarchy}
            </span>

            {/* Level Badge */}
            <span className="text-xs px-2 py-0.5 rounded bg-gray-200 text-gray-700">
              L{category.level}
            </span>

            {/* Leaf Indicator */}
            {isLeaf && (
              <span className="text-xs px-2 py-0.5 rounded bg-green-100 text-green-700">
                Leaf
              </span>
            )}
          </div>

          {/* Render children if expanded */}
          {hasChildren && isExpanded && category.children && (
            <div className="ml-4">
              {renderCategoryTree(category.children, depth + 1)}
            </div>
          )}
        </div>
      )
    })
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-900">Select Categories</h2>
          <p className="text-sm text-gray-600 mt-1">
            Select leaf categories to assign to the product. Only categories without children can have products.
          </p>
        </div>

        {/* Category Tree */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="text-gray-500">Loading categories...</div>
            </div>
          ) : categoryTree.length > 0 ? (
            <div className="space-y-1">
              {renderCategoryTree(categoryTree)}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              No categories found. Please create categories first.
            </div>
          )}
        </div>

        {/* Selected Count */}
        <div className="px-6 py-3 bg-gray-50 border-t border-b border-gray-200">
          <div className="text-sm text-gray-700">
            <span className="font-semibold">{selectedCategoryIds.size}</span> categories selected
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
          <button
            onClick={handleCancel}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={selectedCategoryIds.size === 0}
            className="px-4 py-2 text-sm font-medium text-white bg-black-700 rounded-lg hover:bg-black-800 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Confirm Selection
          </button>
        </div>
      </div>
    </div>
  )
}
