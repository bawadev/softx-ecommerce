import { getSession } from '../db'
import type { UserPreference, UserMeasurements, ProductCategory, SizeOption, MeasurementUnit } from '../types'

/**
 * Get user preferences
 */
export async function getUserPreferences(userId: string): Promise<UserPreference | null> {
  const session = getSession()
  try {
    const result = await session.run(
      `
      MATCH (p:UserPreference {userId: $userId})
      RETURN p {.*}
      `,
      { userId }
    )

    const preference = result.records[0]?.get('p')
    return preference || null
  } finally {
    await session.close()
  }
}

/**
 * Create or update user preferences
 */
export async function upsertUserPreferences(
  userId: string,
  preferences: Omit<UserPreference, 'id' | 'userId'>
): Promise<UserPreference> {
  const session = getSession()
  try {
    const preferenceId = crypto.randomUUID()

    const result = await session.run(
      `
      MERGE (p:UserPreference {userId: $userId})
      ON CREATE SET
        p.id = $id,
        p.userId = $userId,
        p.preferredBrands = $preferredBrands,
        p.preferredColors = $preferredColors,
        p.preferredCategories = $preferredCategories,
        p.priceRange = $priceRange
      ON MATCH SET
        p.preferredBrands = $preferredBrands,
        p.preferredColors = $preferredColors,
        p.preferredCategories = $preferredCategories,
        p.priceRange = $priceRange
      RETURN p {.*}
      `,
      {
        userId,
        id: preferenceId,
        preferredBrands: preferences.preferredBrands,
        preferredColors: preferences.preferredColors,
        preferredCategories: preferences.preferredCategories,
        priceRange: JSON.stringify(preferences.priceRange),
      }
    )

    const preference = result.records[0]?.get('p')

    // Parse the priceRange back from JSON
    if (preference && typeof preference.priceRange === 'string') {
      preference.priceRange = JSON.parse(preference.priceRange)
    }

    return preference
  } finally {
    await session.close()
  }
}

/**
 * Get user measurements
 */
export async function getUserMeasurements(userId: string): Promise<UserMeasurements | null> {
  const session = getSession()
  try {
    const result = await session.run(
      `
      MATCH (m:UserMeasurements {userId: $userId})
      RETURN m {.*}
      `,
      { userId }
    )

    const measurements = result.records[0]?.get('m')
    return measurements || null
  } finally {
    await session.close()
  }
}

/**
 * Create or update user measurements
 */
export async function upsertUserMeasurements(
  userId: string,
  measurements: Omit<UserMeasurements, 'id' | 'userId'>
): Promise<UserMeasurements> {
  const session = getSession()
  try {
    const measurementId = crypto.randomUUID()

    const result = await session.run(
      `
      MERGE (m:UserMeasurements {userId: $userId})
      ON CREATE SET
        m.id = $id,
        m.userId = $userId,
        m.chest = $chest,
        m.waist = $waist,
        m.hips = $hips,
        m.shoulders = $shoulders,
        m.inseam = $inseam,
        m.height = $height,
        m.weight = $weight,
        m.preferredSize = $preferredSize,
        m.unit = $unit
      ON MATCH SET
        m.chest = $chest,
        m.waist = $waist,
        m.hips = $hips,
        m.shoulders = $shoulders,
        m.inseam = $inseam,
        m.height = $height,
        m.weight = $weight,
        m.preferredSize = $preferredSize,
        m.unit = $unit
      RETURN m {.*}
      `,
      {
        userId,
        id: measurementId,
        chest: measurements.chest || null,
        waist: measurements.waist || null,
        hips: measurements.hips || null,
        shoulders: measurements.shoulders || null,
        inseam: measurements.inseam || null,
        height: measurements.height || null,
        weight: measurements.weight || null,
        preferredSize: measurements.preferredSize || null,
        unit: measurements.unit,
      }
    )

    const measurement = result.records[0]?.get('m')
    return measurement
  } finally {
    await session.close()
  }
}
