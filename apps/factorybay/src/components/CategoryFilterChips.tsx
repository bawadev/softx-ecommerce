'use client'

import { ProductCategory } from '@/lib/types'

interface CategoryFilterChipsProps {
  selectedCategories: ProductCategory[]
  onCategoriesChange: (categories: ProductCategory[]) => void
  className?: string
}

const CATEGORY_LABELS: Record<ProductCategory, { label: string; icon: string }> = {
  SHIRT: { label: 'Shirts', icon: '👔' },
  PANTS: { label: 'Pants', icon: '👖' },
  JACKET: { label: 'Jackets', icon: '🧥' },
  DRESS: { label: 'Dresses', icon: '👗' },
  SHOES: { label: 'Shoes', icon: '👟' },
  ACCESSORIES: { label: 'Accessories', icon: '👜' },
}

export default function CategoryFilterChips({
  selectedCategories,
  onCategoriesChange,
  className = '',
}: CategoryFilterChipsProps) {
  const toggleCategory = (category: ProductCategory) => {
    let newCategories: ProductCategory[]

    if (selectedCategories.includes(category)) {
      // Remove category
      newCategories = selectedCategories.filter((c) => c !== category)
    } else {
      // Add category
      newCategories = [...selectedCategories, category]
    }

    onCategoriesChange(newCategories)
  }

  return (
    <div className={`flex flex-wrap gap-3 ${className}`}>
      {(Object.keys(CATEGORY_LABELS) as ProductCategory[]).map((category) => {
        const isSelected = selectedCategories.includes(category)
        const { label, icon } = CATEGORY_LABELS[category]

        return (
          <button
            key={category}
            onClick={() => toggleCategory(category)}
            className={`
              px-4 py-2 rounded-full font-medium transition-all duration-200
              flex items-center gap-2
              ${
                isSelected
                  ? 'bg-black-700 text-white shadow-md transform scale-105'
                  : 'bg-white text-gray-700 border-2 border-gray-200 hover:border-navy-400 hover:text-black-700'
              }
            `}
          >
            <span className="text-lg">{icon}</span>
            <span>{label}</span>
          </button>
        )
      })}
    </div>
  )
}
