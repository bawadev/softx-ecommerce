'use client'

import { type SizeOption } from '@/lib/types'
import { getColorHex } from '@/lib/color-utils'

export type ColorQty = {
  color: string
  quantity: number
}

interface SizeVariantCardProps {
  size: SizeOption
  colorQtys: ColorQty[]
  onAddColor: (size: SizeOption) => void
  onEditColor: (size: SizeOption, index: number, data: ColorQty) => void
  onDeleteColor: (size: SizeOption, index: number) => void
  onDeleteSize: (size: SizeOption) => void
}

export default function SizeVariantCard({
  size,
  colorQtys,
  onAddColor,
  onEditColor,
  onDeleteColor,
  onDeleteSize,
}: SizeVariantCardProps) {
  const total = colorQtys.reduce((sum, c) => sum + c.quantity, 0)

  return (
    <div className="border border-gray-200 rounded-lg bg-white mb-3">
      {/* Size Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-gray-50 border-b border-gray-200">
        <h4 className="text-sm font-semibold text-gray-900">Size: {size}</h4>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-600">
            Total:{' '}
            <span className="font-bold text-green-600">
              {total}
            </span>
          </span>
          <button
            type="button"
            onClick={() => onDeleteSize(size)}
            className="text-red-600 hover:text-red-800 text-xs font-medium transition-colors"
          >
            Remove
          </button>
        </div>
      </div>

      {/* Color-Qty List - Mobile Responsive */}
      <div className="p-4 space-y-3">
        {colorQtys.length > 0 ? (
          <div className="space-y-2">
            {colorQtys.map((colorQty, index) => (
              <div
                key={index}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 bg-gray-50 rounded-lg border border-gray-200"
              >
                {/* Color */}
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <span
                    className="h-5 w-5 rounded-full border border-gray-300 shrink-0"
                    style={{ backgroundColor: getColorHex(colorQty.color) }}
                  />
                  <span className="text-sm text-gray-900 capitalize break-words">
                    {colorQty.color}
                  </span>
                </div>

                {/* Quantity & Actions */}
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="0"
                    value={colorQty.quantity}
                    onChange={(e) =>
                      onEditColor(size, index, {
                        ...colorQty,
                        quantity: parseInt(e.target.value) || 0,
                      })
                    }
                    className="w-20 px-3 py-2 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                  <button
                    type="button"
                    onClick={() => onDeleteColor(size, index)}
                    className="p-2 text-red-600 hover:text-red-800 hover:bg-red-50 rounded-lg transition-colors"
                    title="Remove color"
                    aria-label="Remove color"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-500 text-center py-3 italic">
            No colors added yet
          </p>
        )}

        {/* Add Color Button */}
        <button
          type="button"
          onClick={() => onAddColor(size)}
          className="w-full px-4 py-2.5 text-sm font-medium text-indigo-600 border border-indigo-300 rounded-lg hover:bg-indigo-50 transition-colors"
        >
          + Add Color
        </button>
      </div>
    </div>
  )
}
