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
 * Fashion color type with name and hex properties.
 */
export type FashionColor = {
  name: string
  hex: string
}

/**
 * Get hex color code for a color name.
 * Returns a neutral gray fallback for unknown colors.
 */
export function getColorHex(colorName: string): string {
  return COLOR_MAP[colorName.toLowerCase()] ?? '#e5e7eb'
}

/**
 * Get array of all predefined fashion colors.
 * Used for seeding the database.
 */
export const FASHION_COLORS = Object.entries(COLOR_MAP).map(([name, hex]) => ({
  name: name.charAt(0).toUpperCase() + name.slice(1),
  hex,
}))

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

/**
 * Find the closest color name from COLOR_MAP for a given hex color.
 * Uses Euclidean distance in RGB space to find the nearest match.
 */
export function getClosestColorName(hex: string): string {
  const targetRgb = hexToRgb(hex)
  if (!targetRgb) return 'gray'

  let minDistance = Infinity
  let closestColor = 'gray'

  for (const [name, colorHex] of Object.entries(COLOR_MAP)) {
    const rgb = hexToRgb(colorHex)
    if (!rgb) continue

    // Calculate Euclidean distance in RGB space
    const distance = Math.sqrt(
      Math.pow(targetRgb.r - rgb.r, 2) +
        Math.pow(targetRgb.g - rgb.g, 2) +
        Math.pow(targetRgb.b - rgb.b, 2)
    )

    if (distance < minDistance) {
      minDistance = distance
      closestColor = name
    }
  }

  return closestColor
}

/**
 * Fetch color information from an external color API.
 * Searches for a color by name and returns the hex value.
 */
export async function fetchColorFromAPI(query: string): Promise<FashionColor | null> {
  try {
    // Using the Color API (thecolorapi.com)
    const response = await fetch(`https://www.thecolorapi.com/id?hex=${query}`)
    if (!response.ok) return null

    const data = await response.json()

    if (data && data.hex && data.name) {
      return {
        name: data.name.value,
        hex: data.hex.clean,
      }
    }

    return null
  } catch (error) {
    console.error('Error fetching color from API:', error)
    return null
  }
}
