import { Session } from 'neo4j-driver'
import { HeroSlide, HeroAnimationType, HeroMobileAnimationType, HeroColorTheme, CustomPanelStyle } from '@/lib/types'

/**
 * Helper function to safely convert Neo4j integers to JavaScript numbers
 */
function toNumber(value: any): number {
  if (value && typeof value.toNumber === 'function') {
    return value.toNumber()
  }
  return Number(value)
}

function parseCustomStyle(raw: any): CustomPanelStyle | undefined {
  if (!raw) return undefined
  try {
    const v = typeof raw === 'string' ? JSON.parse(raw) : raw
    if (!v || typeof v !== 'object') return undefined
    return {
      textColor: v.textColor || '#ffffff',
      panelColor: v.panelColor || '#000000',
      panelOpacity: typeof v.panelOpacity === 'number' ? v.panelOpacity : toNumber(v.panelOpacity ?? 35),
      borderEnabled: !!v.borderEnabled,
      borderColor: v.borderColor || '#ffffff',
      borderOpacity: typeof v.borderOpacity === 'number' ? v.borderOpacity : toNumber(v.borderOpacity ?? 15),
      borderWidth: typeof v.borderWidth === 'number' ? v.borderWidth : toNumber(v.borderWidth ?? 1),
    }
  } catch {
    return undefined
  }
}

/**
 * Map a Neo4j record to a HeroSlide object
 */
function mapToHeroSlide(properties: any): HeroSlide {
  return {
    id: properties.id,
    imageUrl: properties.imageUrl,
    mobileImageUrl: properties.mobileImageUrl || undefined,
    animationType: properties.animationType as HeroAnimationType,
    mobileAnimationType: (properties.mobileAnimationType || undefined) as HeroMobileAnimationType | undefined,
    colorTheme: (properties.colorTheme || 'light') as HeroColorTheme,
    mobileColorTheme: (properties.mobileColorTheme || undefined) as HeroColorTheme | undefined,
    customDesktopStyle: parseCustomStyle(properties.customDesktopStyle),
    customMobileStyle: parseCustomStyle(properties.customMobileStyle),
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
    mobileImageUrl?: string
    animationType: HeroAnimationType
    mobileAnimationType?: HeroMobileAnimationType
    colorTheme?: HeroColorTheme
    mobileColorTheme?: HeroColorTheme
    customDesktopStyle?: CustomPanelStyle
    customMobileStyle?: CustomPanelStyle
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
      mobileImageUrl: $mobileImageUrl,
      animationType: $animationType,
      mobileAnimationType: $mobileAnimationType,
      colorTheme: $colorTheme,
      mobileColorTheme: $mobileColorTheme,
      customDesktopStyle: $customDesktopStyle,
      customMobileStyle: $customMobileStyle,
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
      mobileImageUrl: data.mobileImageUrl || null,
      animationType: data.animationType,
      mobileAnimationType: data.mobileAnimationType || null,
      colorTheme: data.colorTheme || 'light',
      mobileColorTheme: data.mobileColorTheme || null,
      customDesktopStyle: data.customDesktopStyle ? JSON.stringify(data.customDesktopStyle) : null,
      customMobileStyle: data.customMobileStyle ? JSON.stringify(data.customMobileStyle) : null,
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
    mobileImageUrl: string | null
    animationType: HeroAnimationType
    mobileAnimationType: HeroMobileAnimationType | null
    colorTheme: HeroColorTheme
    mobileColorTheme: HeroColorTheme | null
    customDesktopStyle: CustomPanelStyle | null
    customMobileStyle: CustomPanelStyle | null
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
  if (data.mobileImageUrl !== undefined) {
    updates.push('h.mobileImageUrl = $mobileImageUrl')
    params.mobileImageUrl = data.mobileImageUrl || null
  }
  if (data.animationType !== undefined) {
    updates.push('h.animationType = $animationType')
    params.animationType = data.animationType
  }
  if (data.mobileAnimationType !== undefined) {
    updates.push('h.mobileAnimationType = $mobileAnimationType')
    params.mobileAnimationType = data.mobileAnimationType || null
  }
  if (data.colorTheme !== undefined) {
    updates.push('h.colorTheme = $colorTheme')
    params.colorTheme = data.colorTheme
  }
  if (data.mobileColorTheme !== undefined) {
    updates.push('h.mobileColorTheme = $mobileColorTheme')
    params.mobileColorTheme = data.mobileColorTheme || null
  }
  if (data.customDesktopStyle !== undefined) {
    updates.push('h.customDesktopStyle = $customDesktopStyle')
    params.customDesktopStyle = data.customDesktopStyle ? JSON.stringify(data.customDesktopStyle) : null
  }
  if (data.customMobileStyle !== undefined) {
    updates.push('h.customMobileStyle = $customMobileStyle')
    params.customMobileStyle = data.customMobileStyle ? JSON.stringify(data.customMobileStyle) : null
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
