'use server'

import { getCurrentUser } from '@/lib/auth'
import {
  getUserPreferences,
  upsertUserPreferences,
  getUserMeasurements,
  upsertUserMeasurements,
} from '@/lib/repositories/user-profile.repository'
import {
  trackProductView,
  getRecentlyViewedProducts,
} from '@/lib/repositories/browsing-history.repository'
import {
  getRecommendationsForUser,
  getSimilarProducts,
} from '@/lib/repositories/recommendation.repository'
import type { ActionResponse, UserPreference, UserMeasurements, ProductCategory, SizeOption, MeasurementUnit } from '@/lib/types'
import type { ProductWithVariants } from '@/lib/repositories/product.repository'

/**
 * Get user's preferences
 */
export async function getUserPreferencesAction(): Promise<
  ActionResponse<{ preferences: UserPreference | null }>
> {
  const user = await getCurrentUser()

  if (!user) {
    return {
      success: false,
      message: 'Unauthorized',
    }
  }

  try {
    const preferences = await getUserPreferences(user.userId)

    return {
      success: true,
      data: { preferences },
    }
  } catch (error) {
    console.error('Get user preferences error:', error)
    return {
      success: false,
      message: 'Failed to fetch preferences',
    }
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
): Promise<ActionResponse<{ preferences: UserPreference }>> {
  const user = await getCurrentUser()

  if (!user) {
    return {
      success: false,
      message: 'Unauthorized',
    }
  }

  try {
    const preferences = await upsertUserPreferences(user.userId, {
      preferredBrands,
      preferredColors,
      preferredCategories,
      priceRange,
    })

    return {
      success: true,
      message: 'Preferences updated successfully',
      data: { preferences },
    }
  } catch (error) {
    console.error('Update preferences error:', error)
    return {
      success: false,
      message: 'Failed to update preferences',
    }
  }
}

/**
 * Get user's measurements
 */
export async function getUserMeasurementsAction(): Promise<
  ActionResponse<{ measurements: UserMeasurements | null }>
> {
  const user = await getCurrentUser()

  if (!user) {
    return {
      success: false,
      message: 'Unauthorized',
    }
  }

  try {
    const measurements = await getUserMeasurements(user.userId)

    return {
      success: true,
      data: { measurements },
    }
  } catch (error) {
    console.error('Get measurements error:', error)
    return {
      success: false,
      message: 'Failed to fetch measurements',
    }
  }
}

/**
 * Update user measurements
 */
export async function updateUserMeasurementsAction(
  measurements: Omit<UserMeasurements, 'id' | 'userId'>
): Promise<ActionResponse<{ measurements: UserMeasurements }>> {
  const user = await getCurrentUser()

  if (!user) {
    return {
      success: false,
      message: 'Unauthorized',
    }
  }

  try {
    const updated = await upsertUserMeasurements(user.userId, measurements)

    return {
      success: true,
      message: 'Measurements updated successfully',
      data: { measurements: updated },
    }
  } catch (error) {
    console.error('Update measurements error:', error)
    return {
      success: false,
      message: 'Failed to update measurements',
    }
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

  try {
    await trackProductView(user.userId, productId)

    return {
      success: true,
    }
  } catch (error) {
    console.error('Track product view error:', error)
    // Don't fail the request if tracking fails
    return {
      success: true,
    }
  }
}

/**
 * Get recently viewed products
 */
export async function getRecentlyViewedProductsAction(): Promise<
  ActionResponse<{ products: ProductWithVariants[] }>
> {
  const user = await getCurrentUser()

  if (!user) {
    return {
      success: true,
      data: { products: [] },
    }
  }

  try {
    const products = await getRecentlyViewedProducts(user.userId, 10)

    return {
      success: true,
      data: { products },
    }
  } catch (error) {
    console.error('Get recently viewed products error:', error)
    return {
      success: false,
      message: 'Failed to fetch recently viewed products',
    }
  }
}

/**
 * Get personalized recommendations
 */
export async function getPersonalizedRecommendationsAction(): Promise<
  ActionResponse<{ products: ProductWithVariants[] }>
> {
  const user = await getCurrentUser()

  if (!user) {
    return {
      success: true,
      data: { products: [] },
    }
  }

  try {
    const products = await getRecommendationsForUser(user.userId, 10)

    return {
      success: true,
      data: { products },
    }
  } catch (error) {
    console.error('Get recommendations error:', error)
    return {
      success: false,
      message: 'Failed to fetch recommendations',
    }
  }
}

/**
 * Get similar products
 */
export async function getSimilarProductsAction(
  productId: string
): Promise<ActionResponse<{ products: ProductWithVariants[] }>> {
  try {
    const products = await getSimilarProducts(productId, 6)

    return {
      success: true,
      data: { products },
    }
  } catch (error) {
    console.error('Get similar products error:', error)
    return {
      success: false,
      message: 'Failed to fetch similar products',
    }
  }
}
