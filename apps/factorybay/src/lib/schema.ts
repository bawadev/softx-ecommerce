/**
 * Database Schema Initialization for Ecom
 * This file contains all the Cypher queries to set up the Neo4j database
 */

import { runQuery } from './db'

// Create constraints and indexes
export const constraints = [
  // User constraints
  `CREATE CONSTRAINT user_email_unique IF NOT EXISTS
   FOR (u:User) REQUIRE u.email IS UNIQUE`,

  `CREATE CONSTRAINT user_id_unique IF NOT EXISTS
   FOR (u:User) REQUIRE u.id IS UNIQUE`,

  // Product constraints
  `CREATE CONSTRAINT product_id_unique IF NOT EXISTS
   FOR (p:Product) REQUIRE p.id IS UNIQUE`,

  `CREATE CONSTRAINT product_sku_unique IF NOT EXISTS
   FOR (p:Product) REQUIRE p.sku IS UNIQUE`,

  // ProductVariant constraints
  `CREATE CONSTRAINT variant_id_unique IF NOT EXISTS
   FOR (v:ProductVariant) REQUIRE v.id IS UNIQUE`,

  // Order constraints
  `CREATE CONSTRAINT order_id_unique IF NOT EXISTS
   FOR (o:Order) REQUIRE o.id IS UNIQUE`,

  `CREATE CONSTRAINT order_number_unique IF NOT EXISTS
   FOR (o:Order) REQUIRE o.orderNumber IS UNIQUE`,

  // Category constraints
  `CREATE CONSTRAINT category_id_unique IF NOT EXISTS
   FOR (c:Category) REQUIRE c.id IS UNIQUE`,

  // Note: slug is NOT unique - same names can appear in different hierarchies/paths
  // e.g., Ladies>Clothing>Tops and Gents>Clothing>Tops both have slug="tops"
]

// Create indexes for better query performance
export const indexes = [
  // User indexes
  `CREATE INDEX user_role_index IF NOT EXISTS
   FOR (u:User) ON (u.role)`,

  // Product indexes
  `CREATE INDEX product_category_index IF NOT EXISTS
   FOR (p:Product) ON (p.category)`,

  `CREATE INDEX product_brand_index IF NOT EXISTS
   FOR (p:Product) ON (p.brand)`,

  `CREATE INDEX product_gender_index IF NOT EXISTS
   FOR (p:Product) ON (p.gender)`,

  // Order indexes
  `CREATE INDEX order_status_index IF NOT EXISTS
   FOR (o:Order) ON (o.status)`,

  `CREATE INDEX order_created_index IF NOT EXISTS
   FOR (o:Order) ON (o.createdAt)`,

  // Category indexes
  `CREATE INDEX category_hierarchy_index IF NOT EXISTS
   FOR (c:Category) ON (c.hierarchy)`,

  `CREATE INDEX category_level_index IF NOT EXISTS
   FOR (c:Category) ON (c.level)`,

  `CREATE INDEX category_featured_index IF NOT EXISTS
   FOR (c:Category) ON (c.isFeatured)`,

  `CREATE INDEX category_active_index IF NOT EXISTS
   FOR (c:Category) ON (c.isActive)`,

  // HeroSlide indexes
  `CREATE INDEX heroslide_display_order IF NOT EXISTS
   FOR (h:HeroSlide) ON (h.displayOrder)`,

  `CREATE INDEX heroslide_active IF NOT EXISTS
   FOR (h:HeroSlide) ON (h.isActive)`,
]

/**
 * Initialize the database schema
 */
export async function initializeSchema(): Promise<void> {
  console.log('Initializing database schema...')

  // Create constraints
  for (const constraint of constraints) {
    try {
      await runQuery(constraint)
      console.log('✓ Constraint created')
    } catch (error) {
      console.error('Failed to create constraint:', error)
    }
  }

  // Create indexes
  for (const index of indexes) {
    try {
      await runQuery(index)
      console.log('✓ Index created')
    } catch (error) {
      console.error('Failed to create index:', error)
    }
  }

  console.log('Schema initialization complete!')
}

/**
 * Clear all data from the database (use with caution!)
 */
export async function clearDatabase(): Promise<void> {
  console.warn('WARNING: Clearing all data from database...')
  await runQuery('MATCH (n) DETACH DELETE n')
  console.log('Database cleared!')
}

/**
 * Get database statistics
 */
export async function getDatabaseStats(): Promise<any> {
  const result = await runQuery(`
    MATCH (n)
    RETURN
      labels(n)[0] as label,
      count(n) as count
    ORDER BY count DESC
  `)
  return result
}
