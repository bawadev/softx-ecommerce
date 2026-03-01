const COLOR_MAP: Record<string, string> = {
  white: '#ffffff',
  black: '#000000',
  navy: '#1e40af',
  khaki: '#c3b091',
  brown: '#8b4513',
  cream: '#fffdd0',
  red: '#dc2626',
  blue: '#2563eb',
  green: '#16a34a',
  yellow: '#eab308',
  pink: '#ec4899',
  purple: '#9333ea',
  orange: '#ea580c',
  gray: '#6b7280',
  grey: '#6b7280',
  beige: '#f5f5dc',
  maroon: '#800000',
  olive: '#808000',
  teal: '#0d9488',
  coral: '#ff7f50',
}

/**
 * Get hex color code for a color name.
 * Returns a neutral gray fallback for unknown colors.
 */
export function getColorHex(colorName: string): string {
  return COLOR_MAP[colorName.toLowerCase()] ?? '#e5e7eb'
}

/**
 * Convert hex color to RGB object.
 */
export function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  // Remove hash if present
  hex = hex.replace('#', '')

  // Handle shorthand hex (e.g., #fff)
  if (hex.length === 3) {
    hex = hex
      .split('')
      .map((char) => char + char)
      .join('')
  }

  // Parse hex values
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : null
}

/**
 * Convert RGB to HSL (Hue, Saturation, Lightness).
 * Returns hue in degrees (0-360), saturation (0-1), and lightness (0-1).
 */
function rgbToHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
  r /= 255
  g /= 255
  b /= 255

  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  let h = 0
  let s = 0
  const l = (max + min) / 2

  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)

    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0)
        break
      case g:
        h = (b - r) / d + 2
        break
      case b:
        h = (r - g) / d + 4
        break
    }

    h /= 6
  }

  return { h: h * 360, s, l }
}

/**
 * Sort an array of colors by hue.
 * Colors should have name and hex properties.
 */
export function sortByHue(colors: Array<{ name: string; hex: string }>): Array<{ name: string; hex: string }> {
  return colors
    .map((color) => {
      const rgb = hexToRgb(color.hex)
      if (!rgb) return { ...color, hue: 0 }

      const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b)
      return { ...color, hue: hsl.h }
    })
    .sort((a, b) => a.hue - b.hue)
    .map(({ hue, ...color }) => color)
}
