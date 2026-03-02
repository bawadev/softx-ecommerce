# Admin Filter Components

This directory contains React components for managing the filter hierarchy in the Ecom admin panel.

## Components

### 1. FilterHierarchyTree

Interactive tree visualization for displaying and managing custom filters.

**File:** `FilterHierarchyTree.tsx`

**Features:**
- Displays filters in a collapsible tree structure
- Shows filter name, level badge, active/inactive status, featured badge
- Optional product count display per filter
- Expandable/collapsible nodes with ChevronRight/ChevronDown icons
- Hover actions: Add Child (+), Add Parent (Link icon), Delete (Trash)
- Auto-expands first 2 levels on load
- Automatic data loading from server on mount
- Refresh button to reload tree data
- Proper indentation based on tree depth (depth * 24px)

**Props:**

```typescript
interface FilterHierarchyTreeProps {
  onAddChild?: (filterId: string) => void
  onAddParent?: (filterId: string) => void
  onDelete?: (filterId: string) => void
  showProductCounts?: boolean
}
```

**Example Usage:**

```tsx
import FilterHierarchyTree from '@/components/admin/FilterHierarchyTree'

export default function FilterManagementPage() {
  function handleAddChild(filterId: string) {
    console.log('Add child to filter:', filterId)
    // Open a dialog to create a new child filter
  }

  function handleAddParent(filterId: string) {
    console.log('Add parent to filter:', filterId)
    // Open a dialog to add a parent relationship
  }

  function handleDelete(filterId: string) {
    console.log('Delete filter:', filterId)
    // Confirm and delete the filter
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Filter Management</h1>

      <FilterHierarchyTree
        onAddChild={handleAddChild}
        onAddParent={handleAddParent}
        onDelete={handleDelete}
        showProductCounts={true}
      />
    </div>
  )
}
```

### 2. FilterValidationPanel

Validation dashboard for checking filter hierarchy integrity.

**File:** `FilterValidationPanel.tsx`

**Features:**
- "Validate Hierarchy" button that checks for cycles and level inconsistencies
- "Recalculate Levels" button that recalculates all filter levels based on parent relationships
- Display validation results with color-coded status (green=valid, red=errors)
- Show list of issues with severity badges (error/warning)
- Loading states with spinner
- Auto re-validates after recalculation
- Uses CheckCircle, AlertCircle, RefreshCw, AlertTriangle icons from lucide-react

**Props:**

No props required - component manages its own state.

**Example Usage:**

```tsx
import FilterValidationPanel from '@/components/admin/FilterValidationPanel'

export default function FilterManagementPage() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Filter Management</h1>

      <div className="mb-6">
        <FilterValidationPanel />
      </div>

      {/* Other admin content */}
    </div>
  )
}
```

## Complete Admin Page Example

Here's a complete example of an admin page that uses both components:

```tsx
'use client'

import { useState } from 'react'
import FilterHierarchyTree from '@/components/admin/FilterHierarchyTree'
import FilterValidationPanel from '@/components/admin/FilterValidationPanel'
import { deleteCustomFilterAction } from '@/app/actions/custom-filters'

export default function FilterManagementPage() {
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [selectedFilterId, setSelectedFilterId] = useState<string | null>(null)
  const [actionType, setActionType] = useState<'child' | 'parent' | null>(null)

  function handleAddChild(filterId: string) {
    setSelectedFilterId(filterId)
    setActionType('child')
    setShowAddDialog(true)
  }

  function handleAddParent(filterId: string) {
    setSelectedFilterId(filterId)
    setActionType('parent')
    setShowAddDialog(true)
  }

  async function handleDelete(filterId: string) {
    if (!confirm('Are you sure you want to delete this filter?')) {
      return
    }

    const result = await deleteCustomFilterAction(filterId)

    if (result.success) {
      alert('Filter deleted successfully')
      // Refresh the tree by remounting or calling a refresh function
    } else {
      alert(`Error: ${result.error}`)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto p-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">
          Filter Hierarchy Management
        </h1>

        {/* Validation Panel */}
        <div className="mb-8">
          <FilterValidationPanel />
        </div>

        {/* Filter Tree */}
        <div>
          <FilterHierarchyTree
            onAddChild={handleAddChild}
            onAddParent={handleAddParent}
            onDelete={handleDelete}
            showProductCounts={true}
          />
        </div>

        {/* Add/Edit Dialog would go here */}
        {showAddDialog && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center">
            <div className="bg-white rounded-lg p-6 max-w-md w-full">
              <h2 className="text-xl font-bold mb-4">
                {actionType === 'child' ? 'Add Child Filter' : 'Add Parent Filter'}
              </h2>
              {/* Form content */}
              <button
                onClick={() => setShowAddDialog(false)}
                className="btn-secondary"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
```

## Server Actions Used

Both components use the following Server Actions from `/src/app/actions/custom-filters.ts`:

### FilterHierarchyTree:
- `getAllFiltersTreeAction()` - Load tree structure
- `getProductCountsForFiltersAction(filterIds)` - Load product counts (optional)

### FilterValidationPanel:
- `validateFilterHierarchyAction()` - Validate hierarchy for cycles and level consistency
- `recalculateFilterLevelsAction()` - Recalculate all filter levels

## Styling

Both components follow the Ecom design system:

- **Colors:** Navy (primary), Gold (accent), Coral (CTA), Gray scales
- **Spacing:** 4px base unit (Tailwind spacing scale)
- **Border Radius:** lg (12px) for cards, md (8px) for buttons
- **Typography:** Inter font family with defined scales
- **Icons:** Lucide React icons
- **Transitions:** 200-300ms ease for smooth interactions
- **Loading States:** Spinner with navy-600 accent
- **Accessibility:** Proper ARIA labels, keyboard navigation support

## Dependencies

- React 19
- TypeScript
- Tailwind CSS
- lucide-react (icons)
- Next.js Server Actions
- Neo4j (database - accessed via Server Actions)

## Notes

- Both components are client components (`'use client'`)
- Data fetching is done automatically on mount
- Error handling is built-in with user-friendly messages
- Loading states are displayed during async operations
- Product counts are calculated recursively (includes descendants)
- Validation checks for both cycles and level inconsistencies
- Recalculation uses iterative approach to handle deep hierarchies
