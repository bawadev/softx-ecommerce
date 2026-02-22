import { Session } from 'neo4j-driver'
import { HeroSlide, HeroAnimationType } from '@/lib/types'

/**
 * Helper function to safely convert Neo4j integers to JavaScript numbers
 */
function toNumber(value: any): number {
  if (value && typeof value.toNumber === 'function') {
    return value.toNumber()
  }
  return Number(value)
}

/**
 * Map a Neo4j record to a HeroSlide object
 */
function mapToHeroSlide(properties: any): HeroSlide {
  return {
    id: properties.id,
    imageUrl: properties.imageUrl,
    animationType: properties.animationType as HeroAnimationType,
    badgeText: properties.badgeText,
    title: properties.title,
    subtitle: properties.subtitle,
    linkUrl: properties.linkUrl || undefined,
    displayOrder: toNumber(properties.displayOrder),
    isActive: properties.isActive,
    createdAt: properties.createdAt.toString(),
    updatedAt: properties.updatedAt.toString(),
  }
}

/**
 * Get all hero slides, optionally filtered to active only
 */
export async function getAllHeroSlides(
  session: Session,
  activeOnly = false
): Promise<HeroSlide[]> {
  const query = activeOnly
    ? `
    MATCH (h:HeroSlide)
    WHERE h.isActive = true
    RETURN h
    ORDER BY h.displayOrder ASC
    `
    : `
    MATCH (h:HeroSlide)
    RETURN h
    ORDER BY h.displayOrder ASC
    `

  const result = await session.run(query)

  return result.records.map((record) => mapToHeroSlide(record.get('h').properties))
}

/**
 * Get a hero slide by ID
 */
export async function getHeroSlideById(
  session: Session,
  id: string
): Promise<HeroSlide | null> {
  const result = await session.run(
    `
    MATCH (h:HeroSlide {id: $id})
    RETURN h
    `,
    { id }
  )

  if (result.records.length === 0) return null

  return mapToHeroSlide(result.records[0].get('h').properties)
}

/**
 * Create a new hero slide
 */
export async function createHeroSlide(
  session: Session,
  data: {
    imageUrl: string
    animationType: HeroAnimationType
    badgeText: string
    title: string
    subtitle: string
    linkUrl?: string
    displayOrder: number
    isActive?: boolean
  }
): Promise<HeroSlide> {
  const result = await session.run(
    `
    CREATE (h:HeroSlide {
      id: randomUUID(),
      imageUrl: $imageUrl,
      animationType: $animationType,
      badgeText: $badgeText,
      title: $title,
      subtitle: $subtitle,
      linkUrl: $linkUrl,
      displayOrder: $displayOrder,
      isActive: $isActive,
      createdAt: $now,
      updatedAt: $now
    })
    RETURN h
    `,
    {
      imageUrl: data.imageUrl,
      animationType: data.animationType,
      badgeText: data.badgeText,
      title: data.title,
      subtitle: data.subtitle,
      linkUrl: data.linkUrl || null,
      displayOrder: data.displayOrder,
      isActive: data.isActive ?? true,
      now: new Date().toISOString(),
    }
  )

  return mapToHeroSlide(result.records[0].get('h').properties)
}

/**
 * Update a hero slide
 */
export async function updateHeroSlide(
  session: Session,
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
): Promise<HeroSlide | null> {
  const updates: string[] = []
  const params: Record<string, any> = { id }

  if (data.imageUrl !== undefined) {
    updates.push('h.imageUrl = $imageUrl')
    params.imageUrl = data.imageUrl
  }
  if (data.animationType !== undefined) {
    updates.push('h.animationType = $animationType')
    params.animationType = data.animationType
  }
  if (data.badgeText !== undefined) {
    updates.push('h.badgeText = $badgeText')
    params.badgeText = data.badgeText
  }
  if (data.title !== undefined) {
    updates.push('h.title = $title')
    params.title = data.title
  }
  if (data.subtitle !== undefined) {
    updates.push('h.subtitle = $subtitle')
    params.subtitle = data.subtitle
  }
  if (data.linkUrl !== undefined) {
    updates.push('h.linkUrl = $linkUrl')
    params.linkUrl = data.linkUrl || null
  }
  if (data.displayOrder !== undefined) {
    updates.push('h.displayOrder = $displayOrder')
    params.displayOrder = data.displayOrder
  }
  if (data.isActive !== undefined) {
    updates.push('h.isActive = $isActive')
    params.isActive = data.isActive
  }

  if (updates.length === 0) return null

  updates.push('h.updatedAt = $updatedAt')
  params.updatedAt = new Date().toISOString()

  const result = await session.run(
    `
    MATCH (h:HeroSlide {id: $id})
    SET ${updates.join(', ')}
    RETURN h
    `,
    params
  )

  if (result.records.length === 0) return null

  return mapToHeroSlide(result.records[0].get('h').properties)
}

/**
 * Delete a hero slide
 */
export async function deleteHeroSlide(
  session: Session,
  id: string
): Promise<boolean> {
  const result = await session.run(
    `
    MATCH (h:HeroSlide {id: $id})
    DELETE h
    RETURN count(h) as deleted
    `,
    { id }
  )

  return result.records[0].get('deleted') > 0
}

/**
 * Reorder hero slides - update displayOrder for multiple slides at once
 */
export async function reorderHeroSlides(
  session: Session,
  slides: Array<{ id: string; displayOrder: number }>
): Promise<boolean> {
  for (const slide of slides) {
    await session.run(
      `
      MATCH (h:HeroSlide {id: $id})
      SET h.displayOrder = $displayOrder, h.updatedAt = $now
      `,
      {
        id: slide.id,
        displayOrder: slide.displayOrder,
        now: new Date().toISOString(),
      }
    )
  }

  return true
}
