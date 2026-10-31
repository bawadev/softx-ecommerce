'use client'

/**
 * Reusable editor for the custom "panel" theme used by hero slides.
 * Shared between the Desktop and Mobile sections of the hero slide admin form.
 *
 * Input/output shape matches CustomPanelStyle — hex colors + 0-100 opacity fields.
 */

import type { CustomPanelStyle } from '@/lib/types'

export const DEFAULT_CUSTOM_STYLE: CustomPanelStyle = {
  textColor: '#ffffff',
  panelColor: '#000000',
  panelOpacity: 35,
  borderEnabled: true,
  borderColor: '#ffffff',
  borderOpacity: 15,
  borderWidth: 1,
}

interface PanelThemeEditorProps {
  value: CustomPanelStyle
  onChange: (value: CustomPanelStyle) => void
  /** Visible label shown above the editor (e.g. "Desktop Custom Theme"). */
  label?: string
  /** Small preview title used in the preview swatch. */
  previewTitle?: string
  /** Small preview subtitle used in the preview swatch. */
  previewSubtitle?: string
}

function HexColorInput({
  value,
  onChange,
  label,
}: {
  value: string
  onChange: (hex: string) => void
  label: string
}) {
  return (
    <div className="flex items-center gap-2">
      <label className="text-xs text-gray-600 w-28 flex-shrink-0">{label}</label>
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-7 w-10 rounded border border-gray-300 cursor-pointer bg-transparent"
      />
      <input
        type="text"
        value={value}
        onChange={(e) => {
          const v = e.target.value.trim()
          if (/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(v) || v === '') {
            onChange(v || '#000000')
          }
        }}
        className="flex-1 min-w-0 px-2 py-1.5 text-sm border border-gray-300 rounded font-mono uppercase focus:ring-1 focus:ring-gray-400 focus:border-gray-400"
        placeholder="#000000"
      />
    </div>
  )
}

function OpacitySlider({
  value,
  onChange,
  label,
}: {
  value: number
  onChange: (v: number) => void
  label: string
}) {
  return (
    <div className="flex items-center gap-2">
      <label className="text-xs text-gray-600 w-28 flex-shrink-0">{label}</label>
      <input
        type="range"
        min={0}
        max={100}
        step={1}
        value={value}
        onChange={(e) => onChange(parseInt(e.target.value, 10))}
        className="flex-1 accent-black-700"
      />
      <span className="text-xs text-gray-700 font-mono w-10 text-right">{value}%</span>
    </div>
  )
}

function hexToRgba(hex: string, opacity: number): string {
  const h = hex.replace('#', '')
  const r = parseInt(h.length === 3 ? h[0] + h[0] : h.slice(0, 2), 16)
  const g = parseInt(h.length === 3 ? h[1] + h[1] : h.slice(2, 4), 16)
  const b = parseInt(h.length === 3 ? h[2] + h[2] : h.slice(4, 6), 16)
  return `rgba(${r}, ${g}, ${b}, ${Math.max(0, Math.min(1, opacity / 100))})`
}

export default function PanelThemeEditor({
  value,
  onChange,
  label = 'Custom Theme',
  previewTitle = 'Preview Title',
  previewSubtitle = 'Preview subtitle line',
}: PanelThemeEditorProps) {
  const update = (patch: Partial<CustomPanelStyle>) => onChange({ ...value, ...patch })

  return (
    <div className="border border-gray-200 rounded-lg p-4 bg-gray-50 space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-gray-900">{label}</h4>
        <button
          type="button"
          onClick={() => onChange(DEFAULT_CUSTOM_STYLE)}
          className="text-xs text-gray-500 hover:text-gray-700 underline"
        >
          Reset
        </button>
      </div>

      {/* Preview swatch */}
      <div
        className="rounded-lg p-4 h-24 flex items-center"
        style={{
          background:
            'linear-gradient(135deg, #666 0%, #333 50%, #111 100%)',
        }}
      >
        <div
          className="rounded-lg px-4 py-3 w-full max-w-xs"
          style={{
            background: hexToRgba(value.panelColor, value.panelOpacity),
            backdropFilter: 'blur(10px)',
            WebkitBackdropFilter: 'blur(10px)',
            border: value.borderEnabled
              ? `${value.borderWidth}px solid ${hexToRgba(value.borderColor, value.borderOpacity)}`
              : 'none',
          }}
        >
          <div
            className="text-base font-bold leading-tight truncate"
            style={{ color: value.textColor }}
          >
            {previewTitle}
          </div>
          <div
            className="text-xs leading-snug truncate opacity-70"
            style={{ color: value.textColor }}
          >
            {previewSubtitle}
          </div>
        </div>
      </div>

      {/* Text & panel */}
      <div className="space-y-2">
        <HexColorInput
          value={value.textColor}
          onChange={(v) => update({ textColor: v })}
          label="Font color"
        />
        <HexColorInput
          value={value.panelColor}
          onChange={(v) => update({ panelColor: v })}
          label="Panel color"
        />
        <OpacitySlider
          value={value.panelOpacity}
          onChange={(v) => update({ panelOpacity: v })}
          label="Panel opacity"
        />
      </div>

      {/* Border */}
      <div className="space-y-2 pt-2 border-t border-gray-200">
        <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer">
          <input
            type="checkbox"
            checked={value.borderEnabled}
            onChange={(e) => update({ borderEnabled: e.target.checked })}
            className="rounded border-gray-300"
          />
          <span className="font-medium">Enable border</span>
        </label>

        {value.borderEnabled && (
          <>
            <HexColorInput
              value={value.borderColor}
              onChange={(v) => update({ borderColor: v })}
              label="Border color"
            />
            <OpacitySlider
              value={value.borderOpacity}
              onChange={(v) => update({ borderOpacity: v })}
              label="Border opacity"
            />
            <div className="flex items-center gap-2">
              <label className="text-xs text-gray-600 w-28 flex-shrink-0">Border width</label>
              <input
                type="range"
                min={0}
                max={4}
                step={1}
                value={value.borderWidth}
                onChange={(e) => update({ borderWidth: parseInt(e.target.value, 10) })}
                className="flex-1 accent-black-700"
              />
              <span className="text-xs text-gray-700 font-mono w-10 text-right">{value.borderWidth}px</span>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
