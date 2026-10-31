'use client'

import { useState, useRef, useMemo, useEffect } from 'react'
import {
  FASHION_COLORS,
  getColorHex,
  getClosestColorName,
  fetchColorFromAPI,
  sortByHue,
  type FashionColor,
} from '@/lib/color-utils'
import { getColorsAction } from '@/app/actions/colors'

interface ColorPickerProps {
  value: string
  onChange: (color: string) => void
  colors?: FashionColor[]
}

export default function ColorPicker({ value, onChange, colors: externalColors }: ColorPickerProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [isLookingUp, setIsLookingUp] = useState(false)
  const [dbColors, setDbColors] = useState<FashionColor[]>([])
  const [loadingDbColors, setLoadingDbColors] = useState(true)
  const colorInputRef = useRef<HTMLInputElement>(null)

  const selectedHex = getColorHex(value)

  // Load active colors from database on mount
  useEffect(() => {
    const loadDbColors = async () => {
      try {
        const result = await getColorsAction()
        if (result.success && result.data) {
          const activeColors = result.data
            .filter(c => c.isActive)
            .map(c => ({ name: c.name, hex: c.hex }))
          setDbColors(activeColors)
        }
      } catch (error) {
        console.error('Failed to load database colors:', error)
      } finally {
        setLoadingDbColors(false)
      }
    }
    loadDbColors()
  }, [])

  const allColors = useMemo(() => {
    // Start with database colors (active ones)
    let colors = dbColors.length > 0 ? [...dbColors] : []

    // Add external colors if provided
    if (externalColors && externalColors.length > 0) {
      const externalNames = new Set(colors.map(c => c.name))
      externalColors.forEach(c => {
        if (!externalNames.has(c.name)) {
          colors.push(c)
        }
      })
    }

    // Fall back to FASHION_COLORS if no colors available
    if (colors.length === 0) {
      colors = [...FASHION_COLORS]
    }

    return sortByHue(colors)
  }, [externalColors, dbColors])

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
            ? 'border-gray-400 ring-2 ring-gray-200'
            : 'border-gray-300 hover:border-gray-400'
        }`}
      >
        <span
          className="h-5 w-5 rounded-full border border-gray-200 shrink-0"
          style={{ backgroundColor: selectedHex }}
        />
        <span className={`flex-1 text-left truncate ${value ? 'capitalize text-black-700' : 'text-gray-400'}`}>
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
              className="flex-1 px-2 py-1.5 text-sm border border-gray-300 rounded bg-white focus:ring-2 focus:ring-indigo-500 focus:border-black-500"
              placeholder="Search colors..."
            />
            <button
              type="button"
              onClick={handleAPILookup}
              disabled={isLookingUp || (!search && !value)}
              className="shrink-0 px-2.5 py-1.5 text-xs font-medium text-black-700 border border-gray-300 rounded bg-white hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
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
              className="shrink-0 h-8 w-8 rounded border border-gray-300 bg-white hover:border-gray-400 transition-colors overflow-hidden"
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
            {loadingDbColors ? (
              <div className="flex items-center gap-2 text-xs text-gray-400 py-1">
                <svg className="h-3 w-3 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Loading colors...
              </div>
            ) : (
              <>
                {dbColors.length > 0 && filteredColors.length > 0 && (
                  <div className="w-full text-xs text-gray-500 mb-1 flex items-center gap-1">
                    <span className="inline-block w-2 h-2 rounded-full bg-green-500"></span>
                    Active colors from database
                  </div>
                )}
                {filteredColors.map((color) => {
                  const isFromDb = dbColors.some(db => db.name.toLowerCase() === color.name.toLowerCase())
                  return (
                    <button
                      key={color.name}
                      type="button"
                      onClick={() => handleSelectColor(color.name)}
                      title={`${color.name} (${color.hex})${isFromDb ? ' - Active' : ''}`}
                      className={`h-6 w-6 rounded-full border-2 transition-all hover:scale-110 relative ${
                        value.toLowerCase() === color.name.toLowerCase()
                          ? 'border-black-500 ring-2 ring-gray-300'
                          : 'border-white hover:border-gray-400'
                      }`}
                      style={{ backgroundColor: color.hex }}
                    >
                      {isFromDb && (
                        <span className="absolute -top-1 -right-1 h-2 w-2 bg-green-500 rounded-full border border-white" />
                      )}
                    </button>
                  )
                })}
                {filteredColors.length === 0 && (
                  <p className="text-xs text-gray-400 py-1">No colors match &ldquo;{search}&rdquo;</p>
                )}
              </>
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
              className="text-xs font-medium text-black-700 hover:text-black-700 transition-colors"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
