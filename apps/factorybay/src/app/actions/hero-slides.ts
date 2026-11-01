'use server'

import { deleteFile } from '@/lib/minio'
import type { ActionResponse } from '@softx/engine'
import type { v1 } from '@softx/contract'
import { getCatalog, getAdminCatalog, currentActor } from '@/lib/engine'

/** Failed service Result → the action's envelope message (UNAUTHORIZED keeps this family's exact string). */
function resultMessage(r: { error: { code: string; message: string } }): string {
  return r.error.code === 'UNAUTHORIZED' ? 'Unauthorized. Admin access required.' : r.error.message
}

/**
 * Get all hero slides (public for frontend, all for admin)
 */
export async function getAllHeroSlidesAction(
  activeOnly = false
): Promise<ActionResponse<v1.HeroSlideDTO[]>> {
  try {
    const r = await getCatalog().listHeroSlides(activeOnly)
    if (!r.ok) {
      return { success: false, message: r.error.message || 'Failed to fetch hero slides' }
    }
    return {
      success: true,
      data: r.data,
    }
  } catch (error: any) {
    console.error('Error fetching hero slides:', error)
    return { success: false, message: error.message || 'Failed to fetch hero slides' }
  }
}

/**
 * Create a new hero slide (Admin only — enforced engine-side via the actor)
 */
export async function createHeroSlideAction(
  data: v1.HeroSlideWriteInput
): Promise<ActionResponse<v1.HeroSlideDTO>> {
  try {
    const r = await getAdminCatalog().createHeroSlide(await currentActor(), data)

    if (!r.ok) {
      return { success: false, message: resultMessage(r) }
    }

    return {
      success: true,
      message: 'Hero slide created successfully',
      data: r.data,
    }
  } catch (error: any) {
    console.error('Error creating hero slide:', error)
    return { success: false, message: error.message || 'Failed to create hero slide' }
  }
}

/**
 * Update a hero slide (Admin only — enforced engine-side via the actor).
 * Optional fields pass `null` to CLEAR (mobile image, custom styles, link) —
 * the update input is null-clearable by design.
 */
export async function updateHeroSlideAction(
  id: string,
  data: v1.HeroSlideUpdateInput
): Promise<ActionResponse<v1.HeroSlideDTO>> {
  try {
    const r = await getAdminCatalog().updateHeroSlide(await currentActor(), id, data)

    if (!r.ok) {
      return { success: false, message: resultMessage(r) }
    }

    return {
      success: true,
      message: 'Hero slide updated successfully',
      data: r.data,
    }
  } catch (error: any) {
    console.error('Error updating hero slide:', error)
    return { success: false, message: error.message || 'Failed to update hero slide' }
  }
}

/**
 * Delete a hero slide (Admin only — enforced engine-side via the actor) —
 * also deletes image from MinIO (object storage is transport, stays app-side)
 */
export async function deleteHeroSlideAction(
  id: string
): Promise<ActionResponse<void>> {
  try {
    // Get the slide first to retrieve the image URLs (contract read path)
    const listResult = await getCatalog().listHeroSlides(false)
    if (!listResult.ok) {
      return { success: false, message: listResult.error.message || 'Failed to delete hero slide' }
    }
    const slide = listResult.data.find((s) => s.id === id)
    if (!slide) {
      return { success: false, message: 'Hero slide not found' }
    }

    // Delete from DB
    const r = await getAdminCatalog().deleteHeroSlide(await currentActor(), id)
    if (!r.ok) {
      return { success: false, message: resultMessage(r) }
    }

    // Delete images from MinIO (best effort — don't fail if image deletion fails)
    try {
      if (slide.imageUrl) {
        await deleteFile(slide.imageUrl)
      }
      if (slide.mobileImageUrl) {
        await deleteFile(slide.mobileImageUrl)
      }
    } catch (err) {
      console.warn('Failed to delete hero slide images from MinIO:', err)
    }

    return {
      success: true,
      message: 'Hero slide deleted successfully',
    }
  } catch (error: any) {
    console.error('Error deleting hero slide:', error)
    return { success: false, message: error.message || 'Failed to delete hero slide' }
  }
}

/**
 * Reorder hero slides (Admin only — enforced engine-side via the actor)
 */
export async function reorderHeroSlidesAction(
  slides: Array<{ id: string; displayOrder: number }>
): Promise<ActionResponse<void>> {
  try {
    const r = await getAdminCatalog().reorderHeroSlides(await currentActor(), slides)

    if (!r.ok) {
      return { success: false, message: resultMessage(r) }
    }

    return {
      success: true,
      message: 'Hero slides reordered successfully',
    }
  } catch (error: any) {
    console.error('Error reordering hero slides:', error)
    return { success: false, message: error.message || 'Failed to reorder hero slides' }
  }
}
