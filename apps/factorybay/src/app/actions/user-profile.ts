'use server'

import { getCurrentUser } from '@/lib/auth'
import { getProfileService } from '@/lib/engine'
import type { ActionResponse, ProductCategory } from '@softx/engine'
import type { v1 } from '@softx/contract'

/**
 * Phase 4 Task 6: every action below is a thin wrapper over the engine's
 * ProfileService. Envelopes (keys + messages) are unchanged from the
 * repository-era actions; reads/writes now go through the service and product
 * lists come back as contract ProductDTOs (no app-side adapter).
 */

/**
 * Get user's preferences
 */
export async function getUserPreferencesAction(): Promise<
  ActionResponse<{ preferences: v1.UserPreferencesDTO }>
> {
  const user = await getCurrentUser()

  if (!user) {
    return {
      success: false,
      message: 'Unauthorized',
    }
  }

  const r = await getProfileService().getPreferences(user.userId)

  if (!r.ok) {
    console.error('Get user preferences error:', r.error)
    return {
      success: false,
      message: 'Failed to fetch preferences',
    }
  }

  return {
    success: true,
    data: { preferences: r.data },
  }
}

/**
 * Update user preferences
 */
export async function updateUserPreferencesAction(
  preferredBrands: string[],
  preferredColors: string[],
  preferredCategories: ProductCategory[],
  priceRange: { min: number; max: number }
): Promise<ActionResponse<{ preferences: v1.UserPreferencesDTO }>> {
  const user = await getCurrentUser()

  if (!user) {
    return {
      success: false,
      message: 'Unauthorized',
    }
  }

  const r = await getProfileService().updatePreferences(user.userId, {
    preferredBrands,
    preferredColors,
    preferredCategories,
    priceRange,
  })

  if (!r.ok) {
    console.error('Update preferences error:', r.error)
    return {
      success: false,
      message: 'Failed to update preferences',
    }
  }

  return {
    success: true,
    message: 'Preferences updated successfully',
    data: { preferences: r.data },
  }
}

/**
 * Get user's measurements
 */
export async function getUserMeasurementsAction(): Promise<
  ActionResponse<{ measurements: v1.UserMeasurementsDTO }>
> {
  const user = await getCurrentUser()

  if (!user) {
    return {
      success: false,
      message: 'Unauthorized',
    }
  }

  const r = await getProfileService().getMeasurements(user.userId)

  if (!r.ok) {
    console.error('Get measurements error:', r.error)
    return {
      success: false,
      message: 'Failed to fetch measurements',
    }
  }

  return {
    success: true,
    data: { measurements: r.data },
  }
}

/**
 * Update user measurements
 */
export async function updateUserMeasurementsAction(
  measurements: v1.UserMeasurementsDTO
): Promise<ActionResponse<{ measurements: v1.UserMeasurementsDTO }>> {
  const user = await getCurrentUser()

  if (!user) {
    return {
      success: false,
      message: 'Unauthorized',
    }
  }

  const r = await getProfileService().updateMeasurements(user.userId, measurements)

  if (!r.ok) {
    console.error('Update measurements error:', r.error)
    return {
      success: false,
      message: 'Failed to update measurements',
    }
  }

  return {
    success: true,
    message: 'Measurements updated successfully',
    data: { measurements: r.data },
  }
}

/**
 * Track product view
 */
export async function trackProductViewAction(productId: string): Promise<ActionResponse<null>> {
  const user = await getCurrentUser()

  if (!user) {
    // Don't fail if user is not logged in, just don't track
    return { success: true }
  }

  const r = await getProfileService().trackProductView(user.userId, productId)

  if (!r.ok) {
    console.error('Track product view error:', r.error)
    // Don't fail the request if tracking fails
  }

  return {
    success: true,
  }
}

/**
 * Get recently viewed products
 */
export async function getRecentlyViewedProductsAction(): Promise<
  ActionResponse<{ products: v1.ProductDTO[] }>
> {
  const user = await getCurrentUser()

  if (!user) {
    return {
      success: true,
      data: { products: [] },
    }
  }

  const r = await getProfileService().listRecentlyViewed(user.userId, 10)

  if (!r.ok) {
    console.error('Get recently viewed products error:', r.error)
    return {
      success: false,
      message: 'Failed to fetch recently viewed products',
    }
  }

  return {
    success: true,
    data: { products: r.data },
  }
}

/**
 * Get personalized recommendations
 */
export async function getPersonalizedRecommendationsAction(): Promise<
  ActionResponse<{ products: v1.ProductDTO[] }>
> {
  const user = await getCurrentUser()

  if (!user) {
    return {
      success: true,
      data: { products: [] },
    }
  }

  const r = await getProfileService().listRecommendations(user.userId, 10)

  if (!r.ok) {
    console.error('Get recommendations error:', r.error)
    return {
      success: false,
      message: 'Failed to fetch recommendations',
    }
  }

  return {
    success: true,
    data: { products: r.data },
  }
}

/**
 * Get similar products
 */
export async function getSimilarProductsAction(
  productId: string
): Promise<ActionResponse<{ products: v1.ProductDTO[] }>> {
  const r = await getProfileService().listSimilarProducts(productId, 6)

  if (!r.ok) {
    console.error('Get similar products error:', r.error)
    return {
      success: false,
      message: 'Failed to fetch similar products',
    }
  }

  return {
    success: true,
    data: { products: r.data },
  }
}
