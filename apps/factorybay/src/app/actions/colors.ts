'use server'

import { getAdminCatalog, currentActor } from '@/lib/engine'
import { FASHION_COLORS } from '@/lib/color-utils'

/** Failed service Result → the action's envelope message (UNAUTHORIZED keeps this family's exact string). */
function resultMessage(r: { error: { code: string; message: string } }): string {
  return r.error.code === 'UNAUTHORIZED' ? 'Unauthorized' : r.error.message
}

/**
 * Get all colors (the admin colors surface; every consumer is an admin
 * context — the colors list, the product form's ColorPicker — and the
 * contract's home for it is AdminCatalogService.listColors)
 */
export async function getColorsAction() {
  try {
    const r = await getAdminCatalog().listColors(await currentActor())
    if (!r.ok) {
      return { success: false, message: resultMessage(r) }
    }
    return { success: true, data: r.data }
  } catch (error: unknown) {
    console.error('Error fetching colors:', error)
    return { success: false, message: error instanceof Error ? error.message : 'Failed to fetch colors' }
  }
}

/**
 * Create a new color (admin only — enforced engine-side via the actor)
 */
export async function createColorAction(name: string, hex: string) {
  try {
    const r = await getAdminCatalog().createColor(await currentActor(), name, hex)
    if (!r.ok) {
      return { success: false, message: resultMessage(r) }
    }
    return { success: true, data: r.data }
  } catch (error: unknown) {
    console.error('Error creating color:', error)
    return { success: false, message: error instanceof Error ? error.message : 'Failed to create color' }
  }
}

/**
 * Toggle a color's active status (admin only — enforced engine-side via the actor)
 */
export async function toggleColorActiveAction(id: string) {
  try {
    const r = await getAdminCatalog().toggleColorActive(await currentActor(), id)
    if (!r.ok) {
      return { success: false, message: resultMessage(r) }
    }
    return { success: true, data: r.data }
  } catch (error: unknown) {
    console.error('Error toggling color:', error)
    return { success: false, message: error instanceof Error ? error.message : 'Failed to toggle color' }
  }
}

/**
 * Delete a color (admin only — enforced engine-side via the actor)
 */
export async function deleteColorAction(id: string) {
  try {
    const r = await getAdminCatalog().deleteColor(await currentActor(), id)
    if (!r.ok) {
      return { success: false, message: resultMessage(r) }
    }
    return { success: true }
  } catch (error: unknown) {
    console.error('Error deleting color:', error)
    return { success: false, message: error instanceof Error ? error.message : 'Failed to delete color' }
  }
}

/**
 * Seed default colors from static COLOR_MAP (admin only — enforced engine-side via the actor)
 */
export async function seedColorsAction() {
  try {
    const r = await getAdminCatalog().seedColors(await currentActor(), FASHION_COLORS)
    if (!r.ok) {
      return { success: false, message: resultMessage(r) }
    }
    return { success: true, data: { count: r.data } }
  } catch (error: unknown) {
    console.error('Error seeding colors:', error)
    return { success: false, message: error instanceof Error ? error.message : 'Failed to seed colors' }
  }
}
