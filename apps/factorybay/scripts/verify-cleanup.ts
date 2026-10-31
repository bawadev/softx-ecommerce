/**
 * Verify Database Cleanup
 *
 * This script verifies the state of the database after cleanup
 */

import dotenv from 'dotenv'
import { getSession, closeDriver } from '../src/lib/db'

// Load environment variables from .env.local
dotenv.config({ path: '.env.local' })

async function verifyCleanup() {
  console.log('🔍 Verifying Database Cleanup...\n')
  console.log('='.repeat(60))

  const session = getSession()

  try {
    // Check CustomFilter nodes
    const customFilterResult = await session.run(
      'MATCH (cf:CustomFilter) RETURN count(cf) as count'
    )
    const customFilterCount = customFilterResult.records[0].get('count').toNumber()
    console.log(`\n✓ CustomFilter nodes: ${customFilterCount}`)

    // Check Products
    const productResult = await session.run(`
      MATCH (p:Product)
      OPTIONAL MATCH (p)-[:HAS_CATEGORY]->(c:Category)
      WITH p, collect(c.name) as categories
      RETURN
        count(p) as totalProducts,
        sum(CASE WHEN size(categories) > 0 THEN 1 ELSE 0 END) as productsWithCategories,
        sum(CASE WHEN size(categories) = 0 THEN 1 ELSE 0 END) as productsWithoutCategories
    `)

    const productRecord = productResult.records[0]
    console.log(`\n📦 Products:`)
    console.log(`   Total products: ${productRecord.get('totalProducts').toNumber()}`)
    console.log(`   Products with categories: ${productRecord.get('productsWithCategories').toNumber()}`)
    console.log(`   Products without categories: ${productRecord.get('productsWithoutCategories').toNumber()}`)

    // Check ProductVariants
    const variantResult = await session.run(`
      MATCH (v:ProductVariant)-[:VARIANT_OF]->(p:Product)
      RETURN count(v) as totalVariants
    `)
    console.log(`\n📦 Product Variants:`)
    console.log(`   Total variants: ${variantResult.records[0].get('totalVariants').toNumber()}`)

    // List products without categories
    const uncategorizedResult = await session.run(`
      MATCH (p:Product)
      WHERE NOT EXISTS {
        MATCH (p)-[:HAS_CATEGORY]->(:Category)
      }
      RETURN p.name as name, p.brand as brand, p.id as id
    `)

    if (uncategorizedResult.records.length > 0) {
      console.log(`\n⚠️  Products without categories:`)
      uncategorizedResult.records.forEach((record, index) => {
        console.log(`   ${index + 1}. "${record.get('name')}" by ${record.get('brand')} (ID: ${record.get('id')})`)
      })
    }

    // Category statistics
    const categoryStatsResult = await session.run(`
      MATCH (c:Category)
      WHERE NOT EXISTS {
        MATCH (c)<-[:CHILD_OF]-(child:Category)
      }
      OPTIONAL MATCH (p:Product)-[:HAS_CATEGORY]->(c)
      WITH c, count(DISTINCT p) as productCount
      WHERE productCount > 0
      RETURN c.hierarchy as hierarchy, c.name as name, productCount
      ORDER BY c.hierarchy, productCount DESC
    `)

    console.log(`\n📊 Category Product Distribution:`)
    let currentHierarchy = ''
    categoryStatsResult.records.forEach((record) => {
      const hierarchy = record.get('hierarchy')
      if (hierarchy !== currentHierarchy) {
        console.log(`\n   ${hierarchy.toUpperCase()}:`)
        currentHierarchy = hierarchy
      }
      console.log(`     - ${record.get('name')}: ${record.get('productCount').toNumber()} products`)
    })

    // Check for duplicate products
    const duplicatesResult = await session.run(`
      MATCH (p:Product)
      WITH p.name as name, p.brand as brand, collect(p) as products
      WHERE size(products) > 1
      RETURN count(*) as duplicateGroups, sum(size(products) - 1) as duplicateProducts
    `)

    const dupRecord = duplicatesResult.records[0]
    const duplicateGroups = dupRecord.get('duplicateGroups').toNumber()
    const duplicateProducts = dupRecord.get('duplicateProducts').toNumber()

    console.log(`\n✓ Duplicate Check:`)
    console.log(`   Duplicate groups: ${duplicateGroups}`)
    console.log(`   Duplicate products: ${duplicateProducts}`)

    console.log('\n' + '='.repeat(60))
    console.log('✅ Verification complete!')

  } catch (error) {
    console.error('\n❌ Error during verification:', error)
  } finally {
    await session.close()
    await closeDriver()
  }
}

// Run verification
verifyCleanup()
