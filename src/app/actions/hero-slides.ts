'use server'

import { getSession } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { deleteFile } from '@/lib/minio'
import { ActionResponse, HeroSlide, HeroAnimationType } from '@/lib/types'
import * as heroSlideRepo from '@/lib/repositories/hero-slide.repository'

/**
 * Get all hero slides (public for frontend, all for admin)
 */
export async function getAllHeroSlidesAction(
  activeOnly = false
): Promise<ActionResponse<HeroSlide[]>> {
  const session = getSession()

  try {
    const slides = await heroSlideRepo.getAllHeroSlides(session, activeOnly)

    return {
      success: true,
      data: slides,
    }
  } catch (error: any) {
    console.error('Error fetching hero slides:', error)
    return { success: false, message: error.message || 'Failed to fetch hero slides' }
  } finally {
    await session.close()
  }
}

/**
 * Create a new hero slide (Admin only)
 */
export async function createHeroSlideAction(data: {
  imageUrl: string
  animationType: HeroAnimationType
  badgeText: string
  title: string
  subtitle: string
  linkUrl?: string
  displayOrder: number
  isActive?: boolean
}): Promise<ActionResponse<HeroSlide>> {
  const session = getSession()

  try {
    const user = await getCurrentUser()
    if (!user || user.role !== 'ADMIN') {
      return { success: false, message: 'Unauthorized. Admin access required.' }
    }

    const slide = await heroSlideRepo.createHeroSlide(session, data)

    return {
      success: true,
      message: 'Hero slide created successfully',
      data: slide,
    }
  } catch (error: any) {
    console.error('Error creating hero slide:', error)
    return { success: false, message: error.message || 'Failed to create hero slide' }
  } finally {
    await session.close()
  }
}

/**
 * Update a hero slide (Admin only)
 */
export async function updateHeroSlideAction(
  id: string,
  data: Partial<{
    imageUrl: string
    animationType: HeroAnimationType
    badgeText: string
    title: string
    subtitle: string
    linkUrl: string
    displayOrder: number
    isActive: boolean
  }>
): Promise<ActionResponse<HeroSlide>> {
  const session = getSession()

  try {
    const user = await getCurrentUser()
    if (!user || user.role !== 'ADMIN') {
      return { success: false, message: 'Unauthorized. Admin access required.' }
    }

    const slide = await heroSlideRepo.updateHeroSlide(session, id, data)

    if (!slide) {
      return { success: false, message: 'Hero slide not found' }
    }

    return {
      success: true,
      message: 'Hero slide updated successfully',
      data: slide,
    }
  } catch (error: any) {
    console.error('Error updating hero slide:', error)
    return { success: false, message: error.message || 'Failed to update hero slide' }
  } finally {
    await session.close()
  }
}

/**
 * Delete a hero slide (Admin only) — also deletes image from MinIO
 */
export async function deleteHeroSlideAction(
  id: string
): Promise<ActionResponse<void>> {
  const session = getSession()

  try {
    const user = await getCurrentUser()
    if (!user || user.role !== 'ADMIN') {
      return { success: false, message: 'Unauthorized. Admin access required.' }
    }

    // Get the slide first to retrieve the image URL
    const slide = await heroSlideRepo.getHeroSlideById(session, id)
    if (!slide) {
      return { success: false, message: 'Hero slide not found' }
    }

    // Delete from DB
    const deleted = await heroSlideRepo.deleteHeroSlide(session, id)
    if (!deleted) {
      return { success: false, message: 'Failed to delete hero slide' }
    }

    // Delete image from MinIO (best effort — don't fail if image deletion fails)
    try {
      if (slide.imageUrl) {
        await deleteFile(slide.imageUrl)
      }
    } catch (err) {
      console.warn('Failed to delete hero slide image from MinIO:', err)
    }

    return {
      success: true,
      message: 'Hero slide deleted successfully',
    }
  } catch (error: any) {
    console.error('Error deleting hero slide:', error)
    return { success: false, message: error.message || 'Failed to delete hero slide' }
  } finally {
    await session.close()
  }
}

/**
 * Reorder hero slides (Admin only)
 */
export async function reorderHeroSlidesAction(
  slides: Array<{ id: string; displayOrder: number }>
): Promise<ActionResponse<void>> {
  const session = getSession()

  try {
    const user = await getCurrentUser()
    if (!user || user.role !== 'ADMIN') {
      return { success: false, message: 'Unauthorized. Admin access required.' }
    }

    await heroSlideRepo.reorderHeroSlides(session, slides)

    return {
      success: true,
      message: 'Hero slides reordered successfully',
    }
  } catch (error: any) {
    console.error('Error reordering hero slides:', error)
    return { success: false, message: error.message || 'Failed to reorder hero slides' }
  } finally {
    await session.close()
  }
}
