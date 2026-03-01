import { Session } from 'neo4j-driver'
import { v4 as uuidv4 } from 'uuid'

export interface Color {
  id: string
  name: string
  hex: string
  isActive: boolean
  createdAt: string
}

/**
 * Get all colors sorted by name
 */
export async function getAllColors(session: Session): Promise<Color[]> {
  const result = await session.run(
    `MATCH (c:Color)
     RETURN c { .id, .name, .hex, .createdAt, isActive: coalesce(c.isActive, true) } AS color
     ORDER BY c.name`
  )
  return result.records.map((r) => r.get('color') as Color)
}

/**
 * Create a new color
 */
export async function createColor(
  session: Session,
  data: { name: string; hex: string }
): Promise<Color> {
  const id = uuidv4()
  const now = new Date().toISOString()
  const result = await session.run(
    `CREATE (c:Color {
       id: $id,
       name: $name,
       hex: $hex,
       isActive: true,
       createdAt: $createdAt
     })
     RETURN c { .id, .name, .hex, .isActive, .createdAt } AS color`,
    { id, name: data.name.toLowerCase(), hex: data.hex.toLowerCase(), createdAt: now }
  )
  return result.records[0].get('color') as Color
}

/**
 * Toggle a color's active status
 */
export async function toggleColorActive(session: Session, id: string): Promise<Color | null> {
  const result = await session.run(
    `MATCH (c:Color { id: $id })
     SET c.isActive = NOT coalesce(c.isActive, true)
     RETURN c { .id, .name, .hex, .isActive, .createdAt } AS color`,
    { id }
  )
  if (result.records.length === 0) return null
  return result.records[0].get('color') as Color
}

/**
 * Delete a color by id
 */
export async function deleteColor(session: Session, id: string): Promise<boolean> {
  const result = await session.run(
    `MATCH (c:Color { id: $id })
     DELETE c
     RETURN count(c) AS deleted`,
    { id }
  )
  const deleted = result.records[0]?.get('deleted')
  return deleted?.toNumber ? deleted.toNumber() > 0 : Number(deleted) > 0
}

/**
 * Get total color count
 */
export async function getColorCount(session: Session): Promise<number> {
  const result = await session.run(
    `MATCH (c:Color) RETURN count(c) AS count`
  )
  const count = result.records[0]?.get('count')
  return count?.toNumber ? count.toNumber() : Number(count) || 0
}

/**
 * Seed default colors from COLOR_MAP if the database has no colors
 */
export async function seedDefaultColors(
  session: Session,
  colors: Array<{ name: string; hex: string }>
): Promise<number> {
  const existingCount = await getColorCount(session)
  if (existingCount > 0) return 0

  const now = new Date().toISOString()
  const colorRows = colors.map((c) => ({
    id: uuidv4(),
    name: c.name.toLowerCase(),
    hex: c.hex.toLowerCase(),
    isActive: true,
    createdAt: now,
  }))

  await session.run(
    `UNWIND $colors AS c
     CREATE (n:Color {
       id: c.id,
       name: c.name,
       hex: c.hex,
       isActive: c.isActive,
       createdAt: c.createdAt
     })`,
    { colors: colorRows }
  )

  return colorRows.length
}
