'use client'

import { useState, useEffect, useMemo } from 'react'
import { toast } from 'sonner'
import Link from 'next/link'
import { useLocale } from 'next-intl'
import {
  getColorsAction,
  createColorAction,
  deleteColorAction,
  toggleColorActiveAction,
  seedColorsAction,
} from '@/app/actions/colors'
import { hexToRgb, sortByHue } from '@/lib/color-utils'
import type { Color } from '@/lib/repositories/color.repository'
import ConfirmDialog from '@/components/ui/ConfirmDialog'

export default function ColorsClient() {
  const locale = useLocale()
  const [colors, setColors] = useState<Color[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [newName, setNewName] = useState('')
  const [newHex, setNewHex] = useState('#000000')
  const [creating, setCreating] = useState(false)
  const [seeding, setSeeding] = useState(false)
  const [togglingId, setTogglingId] = useState<string | null>(null)
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean
    title: string
    message: string
    onConfirm: () => void
  }>({ isOpen: false, title: '', message: '', onConfirm: () => {} })

  useEffect(() => {
    loadColors()
  }, [])

  async function loadColors() {
    setLoading(true)
    const result = await getColorsAction()
    if (result.success && result.data) {
      const sorted = sortByHue(
        result.data.map((c) => ({ name: c.name, hex: c.hex }))
      )
      const sortedColors = sorted
        .map((s) => result.data!.find((c) => c.name === s.name)!)
        .filter(Boolean)
      setColors(sortedColors)
    }
    setLoading(false)
  }

  const filteredColors = useMemo(() => {
    if (!search.trim()) return colors
    const q = search.toLowerCase()
    return colors.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.hex.toLowerCase().includes(q)
    )
  }, [colors, search])

  const activeCount = useMemo(() => colors.filter((c) => c.isActive).length, [colors])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!newName.trim() || !newHex) return

    setCreating(true)
    const result = await createColorAction(newName.trim(), newHex)
    if (result.success) {
      toast.success(`Color "${newName.trim()}" created`)
      setNewName('')
      setNewHex('#000000')
      await loadColors()
    } else {
      toast.error(result.message || 'Failed to create color')
    }
    setCreating(false)
  }

  async function handleToggleActive(color: Color) {
    setTogglingId(color.id)
    const result = await toggleColorActiveAction(color.id)
    if (result.success && result.data) {
      setColors((prev) =>
        prev.map((c) => (c.id === color.id ? { ...c, isActive: result.data!.isActive } : c))
      )
      toast.success(
        result.data.isActive
          ? `"${color.name}" enabled`
          : `"${color.name}" disabled`
      )
    } else {
      toast.error(result.message || 'Failed to toggle color')
    }
    setTogglingId(null)
  }

  function handleDelete(color: Color) {
    setConfirmDialog({
      isOpen: true,
      title: 'Delete Color',
      message: `Are you sure you want to delete "${color.name}"? This cannot be undone.`,
      onConfirm: async () => {
        setConfirmDialog((prev) => ({ ...prev, isOpen: false }))
        const result = await deleteColorAction(color.id)
        if (result.success) {
          toast.success(`Color "${color.name}" deleted`)
          await loadColors()
        } else {
          toast.error(result.message || 'Failed to delete color')
        }
      },
    })
  }

  async function handleSeed() {
    setSeeding(true)
    const result = await seedColorsAction()
    if (result.success && result.data) {
      toast.success(`Loaded ${result.data.count} default colors`)
      await loadColors()
    } else {
      toast.error(result.message || 'Failed to seed colors')
    }
    setSeeding(false)
  }

  function formatRgb(hex: string): string {
    const rgb = hexToRgb(hex)
    if (!rgb) return '—'
    return `${rgb.r}, ${rgb.g}, ${rgb.b}`
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-navy-900">Color Management</h1>
              <p className="mt-1 text-sm text-gray-600">
                Manage product color swatches for your catalog
              </p>
            </div>
            <Link
              href={`/${locale}/admin`}
              className="text-sm text-navy-600 hover:text-navy-700 font-medium"
            >
              &larr; Back to Dashboard
            </Link>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Stats */}
        <div className="mb-6 flex flex-wrap gap-3">
          <div className="inline-flex items-center gap-2 bg-white px-4 py-2 rounded-lg shadow-sm border border-gray-200">
            <span className="text-sm font-medium text-gray-600">Total:</span>
            <span className="text-lg font-bold text-gray-900">{colors.length}</span>
          </div>
          <div className="inline-flex items-center gap-2 bg-white px-4 py-2 rounded-lg shadow-sm border border-gray-200">
            <span className="text-sm font-medium text-gray-600">Active:</span>
            <span className="text-lg font-bold text-green-600">{activeCount}</span>
          </div>
          <div className="inline-flex items-center gap-2 bg-white px-4 py-2 rounded-lg shadow-sm border border-gray-200">
            <span className="text-sm font-medium text-gray-600">Disabled:</span>
            <span className="text-lg font-bold text-gray-400">{colors.length - activeCount}</span>
          </div>
        </div>

        {/* Add Color Form */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Add New Color</h2>
          <form onSubmit={handleCreate} className="flex flex-wrap items-end gap-4">
            <div className="flex-1 min-w-[200px]">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Color Name
              </label>
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g. Midnight Blue"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-rose-500 focus:border-transparent text-sm"
                required
              />
            </div>
            <div className="w-48">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Hex Code
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={newHex}
                  onChange={(e) => {
                    let v = e.target.value
                    if (!v.startsWith('#')) v = '#' + v
                    setNewHex(v)
                  }}
                  placeholder="#000000"
                  pattern="^#[0-9a-fA-F]{6}$"
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-rose-500 focus:border-transparent text-sm font-mono"
                  required
                />
                <input
                  type="color"
                  value={newHex}
                  onChange={(e) => setNewHex(e.target.value)}
                  className="h-9 w-9 rounded border border-gray-300 cursor-pointer p-0.5"
                />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div
                className="h-9 w-9 rounded-full border-2 border-gray-300 shrink-0"
                style={{ backgroundColor: newHex }}
                title={`Preview: ${newHex}`}
              />
              <button
                type="submit"
                disabled={creating || !newName.trim()}
                className="px-4 py-2 text-sm font-medium text-white bg-rose-600 hover:bg-rose-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {creating ? 'Adding...' : 'Add Color'}
              </button>
            </div>
          </form>
        </div>

        {/* Color List */}
        {loading ? (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
            <div className="animate-spin h-8 w-8 border-4 border-rose-500 border-t-transparent rounded-full mx-auto mb-4" />
            <p className="text-gray-500">Loading colors...</p>
          </div>
        ) : colors.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
            <div className="mx-auto h-16 w-16 rounded-full bg-rose-100 flex items-center justify-center mb-4">
              <svg className="h-8 w-8 text-rose-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No Colors Yet</h3>
            <p className="text-sm text-gray-500 mb-6">
              Get started by loading the default color palette or adding colors manually.
            </p>
            <button
              onClick={handleSeed}
              disabled={seeding}
              className="px-6 py-2.5 text-sm font-medium text-white bg-rose-600 hover:bg-rose-700 rounded-lg transition-colors disabled:opacity-50"
            >
              {seeding ? 'Loading...' : 'Load Default Colors'}
            </button>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            {/* Search / filter bar */}
            <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
              <div className="relative max-w-sm">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Filter colors by name or hex..."
                  className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-rose-500 focus:border-transparent bg-white"
                />
                {search && (
                  <button
                    onClick={() => setSearch('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
              {search && (
                <p className="text-xs text-gray-500 mt-2">
                  Showing {filteredColors.length} of {colors.length} colors
                </p>
              )}
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Color
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Hex
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      RGB
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredColors.map((color) => (
                    <tr
                      key={color.id}
                      className={`transition-colors ${color.isActive ? 'hover:bg-gray-50' : 'bg-gray-50/50 opacity-60'}`}
                    >
                      <td className="px-6 py-3">
                        <div
                          className={`h-8 w-8 rounded-full border-2 shadow-sm ${color.isActive ? 'border-gray-200' : 'border-dashed border-gray-300'}`}
                          style={{ backgroundColor: color.hex }}
                        />
                      </td>
                      <td className="px-6 py-3">
                        <span className={`text-sm font-medium capitalize ${color.isActive ? 'text-gray-900' : 'text-gray-400 line-through'}`}>
                          {color.name}
                        </span>
                      </td>
                      <td className="px-6 py-3">
                        <span className="text-sm font-mono text-gray-600">
                          {color.hex}
                        </span>
                      </td>
                      <td className="px-6 py-3">
                        <span className="text-sm font-mono text-gray-600">
                          {formatRgb(color.hex)}
                        </span>
                      </td>
                      <td className="px-6 py-3 text-center">
                        <button
                          onClick={() => handleToggleActive(color)}
                          disabled={togglingId === color.id}
                          className="inline-flex items-center gap-1.5 group"
                          title={color.isActive ? 'Click to disable' : 'Click to enable'}
                        >
                          {togglingId === color.id ? (
                            <svg className="h-4 w-4 animate-spin text-gray-400" viewBox="0 0 24 24" fill="none">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                            </svg>
                          ) : color.isActive ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-green-100 text-green-700 group-hover:bg-green-200 transition-colors cursor-pointer">
                              <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                              </svg>
                              Active
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-gray-100 text-gray-500 group-hover:bg-gray-200 transition-colors cursor-pointer">
                              <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                              </svg>
                              Disabled
                            </span>
                          )}
                        </button>
                      </td>
                      <td className="px-6 py-3 text-right">
                        <button
                          onClick={() => handleDelete(color)}
                          className="inline-flex items-center px-2.5 py-1.5 text-xs font-medium text-red-600 hover:text-red-800 hover:bg-red-50 rounded transition-colors"
                        >
                          <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                  {filteredColors.length === 0 && search && (
                    <tr>
                      <td colSpan={6} className="px-6 py-8 text-center text-sm text-gray-500">
                        No colors match &ldquo;{search}&rdquo;
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        title={confirmDialog.title}
        message={confirmDialog.message}
        onConfirm={confirmDialog.onConfirm}
        onCancel={() => setConfirmDialog((prev) => ({ ...prev, isOpen: false }))}
        type="danger"
      />
    </div>
  )
}
