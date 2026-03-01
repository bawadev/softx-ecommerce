'use server'

import { getSession } from '@/lib/db'
import { isAdmin } from '@/lib/auth'
import * as colorRepo from '@/lib/repositories/color.repository'
import { FASHION_COLORS } from '@/lib/color-utils'

/**
 * Get all colors (public)
 */
export async function getColorsAction() {
  const session = getSession()
  try {
    const colors = await colorRepo.getAllColors(session)
    return { success: true, data: colors }
  } catch (error: unknown) {
    console.error('Error fetching colors:', error)
    return { success: false, message: error instanceof Error ? error.message : 'Failed to fetch colors' }
  } finally {
    await session.close()
  }
}

/**
 * Create a new color (admin only)
 */
export async function createColorAction(name: string, hex: string) {
  if (!(await isAdmin())) {
    return { success: false, message: 'Unauthorized' }
  }

  if (!name || !name.trim()) {
    return { success: false, message: 'Color name is required' }
  }

  if (!/^#[0-9a-fA-F]{6}$/.test(hex)) {
    return { success: false, message: 'Invalid hex color (must be #RRGGBB)' }
  }

  const session = getSession()
  try {
    const color = await colorRepo.createColor(session, { name: name.trim(), hex })
    return { success: true, data: color }
  } catch (error: unknown) {
    console.error('Error creating color:', error)
    const msg = error instanceof Error ? error.message : 'Failed to create color'
    if (msg.includes('already exists')) {
      return { success: false, message: 'A color with that name already exists' }
    }
    return { success: false, message: msg }
  } finally {
    await session.close()
  }
}

/**
 * Toggle a color's active status (admin only)
 */
export async function toggleColorActiveAction(id: string) {
  if (!(await isAdmin())) {
    return { success: false, message: 'Unauthorized' }
  }

  const session = getSession()
  try {
    const color = await colorRepo.toggleColorActive(session, id)
    if (!color) {
      return { success: false, message: 'Color not found' }
    }
    return { success: true, data: color }
  } catch (error: unknown) {
    console.error('Error toggling color:', error)
    return { success: false, message: error instanceof Error ? error.message : 'Failed to toggle color' }
  } finally {
    await session.close()
  }
}

/**
 * Delete a color (admin only)
 */
export async function deleteColorAction(id: string) {
  if (!(await isAdmin())) {
    return { success: false, message: 'Unauthorized' }
  }

  const session = getSession()
  try {
    const deleted = await colorRepo.deleteColor(session, id)
    if (!deleted) {
      return { success: false, message: 'Color not found' }
    }
    return { success: true }
  } catch (error: unknown) {
    console.error('Error deleting color:', error)
    return { success: false, message: error instanceof Error ? error.message : 'Failed to delete color' }
  } finally {
    await session.close()
  }
}

/**
 * Seed default colors from static COLOR_MAP (admin only)
 */
export async function seedColorsAction() {
  if (!(await isAdmin())) {
    return { success: false, message: 'Unauthorized' }
  }

  const session = getSession()
  try {
    const count = await colorRepo.seedDefaultColors(session, FASHION_COLORS)
    if (count === 0) {
      return { success: false, message: 'Colors already exist in the database' }
    }
    return { success: true, data: { count } }
  } catch (error: unknown) {
    console.error('Error seeding colors:', error)
    return { success: false, message: error instanceof Error ? error.message : 'Failed to seed colors' }
  } finally {
    await session.close()
  }
}

/**
 * Get color count (public)
 */
export async function getColorCountAction() {
  const session = getSession()
  try {
    const count = await colorRepo.getColorCount(session)
    return { success: true, data: count }
  } catch (error: unknown) {
    console.error('Error getting color count:', error)
    return { success: false, message: error instanceof Error ? error.message : 'Failed to get color count' }
  } finally {
    await session.close()
  }
}
