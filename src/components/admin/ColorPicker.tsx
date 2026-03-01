'use client'

import { useState, useRef, useMemo } from 'react'
import {
  FASHION_COLORS,
  getColorHex,
  getClosestColorName,
  fetchColorFromAPI,
  sortByHue,
  type FashionColor,
} from '@/lib/color-utils'

interface ColorPickerProps {
  value: string
  onChange: (color: string) => void
  colors?: FashionColor[]
}

export default function ColorPicker({ value, onChange, colors: externalColors }: ColorPickerProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [isLookingUp, setIsLookingUp] = useState(false)
  const colorInputRef = useRef<HTMLInputElement>(null)

  const selectedHex = getColorHex(value)

  const allColors = useMemo(() => {
    const base = externalColors && externalColors.length > 0 ? externalColors : FASHION_COLORS
    return sortByHue(base)
  }, [externalColors])

  const filteredColors = useMemo(() => {
    if (!search) return allColors
    const q = search.toLowerCase()
    return allColors.filter((c) => c.name.toLowerCase().includes(q))
  }, [search, allColors])

  function handleSelectColor(name: string) {
    onChange(name.toLowerCase())
    setSearch('')
  }

  function handleNativeColorChange(hex: string) {
    const name = getClosestColorName(hex)
    onChange(name.toLowerCase())
  }

  async function handleAPILookup() {
    const query = search || value
    if (!query) return
    setIsLookingUp(true)
    try {
      const result = await fetchColorFromAPI(query)
      if (result) {
        onChange(result.name.toLowerCase())
        setSearch('')
      }
    } finally {
      setIsLookingUp(false)
    }
  }

  return (
    <div>
      {/* Trigger — shows selected color or placeholder */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full flex items-center gap-2 px-2 py-1.5 text-sm border rounded transition-colors ${
          isOpen
            ? 'border-indigo-400 ring-2 ring-indigo-100'
            : 'border-gray-300 hover:border-gray-400'
        }`}
      >
        <span
          className="h-5 w-5 rounded-full border border-gray-200 shrink-0"
          style={{ backgroundColor: selectedHex }}
        />
        <span className={`flex-1 text-left truncate ${value ? 'capitalize text-gray-900' : 'text-gray-400'}`}>
          {value || 'Select a color...'}
        </span>
        {value && (
          <span className="text-xs text-gray-400">{selectedHex}</span>
        )}
        <svg
          className={`h-4 w-4 text-gray-400 shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Collapsible panel */}
      {isOpen && (
        <div className="mt-1.5 border border-gray-200 rounded-lg bg-gray-50 p-3 space-y-3">
          {/* Search + API lookup row */}
          <div className="flex gap-2">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 px-2 py-1.5 text-sm border border-gray-300 rounded bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              placeholder="Search colors..."
            />
            <button
              type="button"
              onClick={handleAPILookup}
              disabled={isLookingUp || (!search && !value)}
              className="shrink-0 px-2.5 py-1.5 text-xs font-medium text-indigo-600 border border-indigo-300 rounded bg-white hover:bg-indigo-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              title="Look up color from thecolorapi.com"
            >
              {isLookingUp ? (
                <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              ) : (
                'Find'
              )}
            </button>
            <button
              type="button"
              onClick={() => colorInputRef.current?.click()}
              className="shrink-0 h-8 w-8 rounded border border-gray-300 bg-white hover:border-indigo-400 transition-colors overflow-hidden"
              title="Pick custom color"
              style={{ backgroundColor: selectedHex }}
            />
            <input
              ref={colorInputRef}
              type="color"
              value={selectedHex}
              onChange={(e) => handleNativeColorChange(e.target.value)}
              className="sr-only"
              tabIndex={-1}
            />
          </div>

          {/* Swatch grid */}
          <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto">
            {filteredColors.map((color) => (
              <button
                key={color.name}
                type="button"
                onClick={() => handleSelectColor(color.name)}
                title={`${color.name} (${color.hex})`}
                className={`h-6 w-6 rounded-full border-2 transition-all hover:scale-110 ${
                  value.toLowerCase() === color.name.toLowerCase()
                    ? 'border-indigo-500 ring-2 ring-indigo-300'
                    : 'border-white hover:border-gray-400'
                }`}
                style={{ backgroundColor: color.hex }}
              />
            ))}
            {filteredColors.length === 0 && (
              <p className="text-xs text-gray-400 py-1">No colors match &ldquo;{search}&rdquo;</p>
            )}
          </div>

          {/* Clear / done actions */}
          <div className="flex items-center justify-between pt-1 border-t border-gray-200">
            {value ? (
              <button
                type="button"
                onClick={() => { onChange(''); setSearch('') }}
                className="text-xs text-gray-400 hover:text-red-500 transition-colors"
              >
                Clear
              </button>
            ) : (
              <span />
            )}
            <button
              type="button"
              onClick={() => { setIsOpen(false); setSearch('') }}
              className="text-xs font-medium text-indigo-600 hover:text-indigo-800 transition-colors"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
