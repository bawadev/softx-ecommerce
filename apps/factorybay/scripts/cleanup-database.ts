/**
 * Database Cleanup Script
 *
 * This script performs the following cleanup operations:
 * 1. Deletes all CustomFilter nodes and their relationships
 * 2. Finds and removes duplicate Product and ProductVariant nodes
 * 3. Assigns products to appropriate leaf categories based on their names/brands
 */

import dotenv from 'dotenv'
import { getSession, closeDriver } from '../src/lib/db'
import { getLeafCategories, assignProductToCategories } from '../src/lib/repositories/category.repository'

// Load environment variables from .env.local
dotenv.config({ path: '.env.local' })

interface CleanupStats {
  customFiltersDeleted: number
  duplicateProductsDeleted: number
  duplicateVariantsDeleted: number
  productsAssignedToCategories: number
  errors: string[]
}

const stats: CleanupStats = {
  customFiltersDeleted: 0,
  duplicateProductsDeleted: 0,
  duplicateVariantsDeleted: 0,
  productsAssignedToCategories: 0,
  errors: []
}

/**
 * Step 1: Delete all CustomFilter nodes and relationships
 */
async function deleteCustomFilters() {
  console.log('\n📦 Step 1: Deleting CustomFilter nodes...')
  const session = getSession()

  try {
    // First, count how many exist
    const countResult = await session.run(
      'MATCH (cf:CustomFilter) RETURN count(cf) as count'
    )
    const count = countResult.records[0].get('count').toNumber()

    if (count === 0) {
      console.log('   ✓ No CustomFilter nodes found')
      return
    }

    console.log(`   Found ${count} CustomFilter nodes`)

    // Delete all CustomFilter nodes and their relationships
    await session.run('MATCH (cf:CustomFilter) DETACH DELETE cf')

    stats.customFiltersDeleted = count
    console.log(`   ✓ Deleted ${count} CustomFilter nodes and their relationships`)

  } catch (error) {
    const errorMsg = `Failed to delete CustomFilter nodes: ${error}`
    console.error(`   ✗ ${errorMsg}`)
    stats.errors.push(errorMsg)
  } finally {
    await session.close()
  }
}

/**
 * Step 2: Find and remove duplicate products
 * Duplicates = Products with same name AND brand
 */
async function removeDuplicateProducts() {
  console.log('\n📦 Step 2: Removing duplicate products...')
  const session = getSession()

  try {
    // Find duplicate products (same name + brand)
    const duplicatesResult = await session.run(`
      MATCH (p:Product)
      WITH p.name as name, p.brand as brand, collect(p) as products
      WHERE size(products) > 1
      RETURN name, brand, products
    `)

    if (duplicatesResult.records.length === 0) {
      console.log('   ✓ No duplicate products found')
      return
    }

    console.log(`   Found ${duplicatesResult.records.length} groups of duplicate products`)

    for (const record of duplicatesResult.records) {
      const name = record.get('name')
      const brand = record.get('brand')
      const products = record.get('products')

      console.log(`   Processing: "${name}" by ${brand} (${products.length} duplicates)`)

      // Keep the first product, delete the rest
      const keepProduct = products[0]
      const deleteProducts = products.slice(1)

      for (const product of deleteProducts) {
        const productId = product.properties.id

        // First, handle variants - reassign to kept product or delete
        const variantsResult = await session.run(
          `MATCH (v:ProductVariant)-[:VARIANT_OF]->(p:Product {id: $productId})
           RETURN v`,
          { productId }
        )

        for (const variantRecord of variantsResult.records) {
          const variant = variantRecord.get('v')
          const variantId = variant.properties.id
          const variantSize = variant.properties.size
          const variantColor = variant.properties.color

          // Check if kept product already has this size/color variant
          const existingVariantResult = await session.run(
            `MATCH (v:ProductVariant)-[:VARIANT_OF]->(p:Product {id: $keepProductId})
             WHERE v.size = $size AND v.color = $color
             RETURN v`,
            {
              keepProductId: keepProduct.properties.id,
              size: variantSize,
              color: variantColor
            }
          )

          if (existingVariantResult.records.length > 0) {
            // Duplicate variant exists, delete this one
            await session.run(
              `MATCH (v:ProductVariant {id: $variantId})
               DETACH DELETE v`,
              { variantId }
            )
            stats.duplicateVariantsDeleted++
          } else {
            // Reassign variant to kept product
            await session.run(
              `MATCH (v:ProductVariant {id: $variantId})
               MATCH (p:Product {id: $keepProductId})
               MATCH (v)-[r:VARIANT_OF]->()
               DELETE r
               CREATE (v)-[:VARIANT_OF]->(p)
               SET v.productId = $keepProductId`,
              { variantId, keepProductId: keepProduct.properties.id }
            )
          }
        }

        // Delete the duplicate product
        await session.run(
          `MATCH (p:Product {id: $productId})
           DETACH DELETE p`,
          { productId }
        )

        stats.duplicateProductsDeleted++
      }
    }

    console.log(`   ✓ Deleted ${stats.duplicateProductsDeleted} duplicate products`)
    console.log(`   ✓ Deleted ${stats.duplicateVariantsDeleted} duplicate variants`)

  } catch (error) {
    const errorMsg = `Failed to remove duplicate products: ${error}`
    console.error(`   ✗ ${errorMsg}`)
    stats.errors.push(errorMsg)
  } finally {
    await session.close()
  }
}

/**
 * Step 3: Assign products to appropriate categories based on their names
 */
async function assignProductsToCategories() {
  console.log('\n📦 Step 3: Assigning products to categories...')
  const session = getSession()

  try {
    // Get all leaf categories
    const leafCategories = await getLeafCategories(session)
    console.log(`   Found ${leafCategories.length} leaf categories`)

    // Build a mapping for easy lookup
    const categoryMap = new Map<string, string>()

    for (const category of leafCategories) {
      const key = `${category.hierarchy}:${category.name.toLowerCase()}`
      categoryMap.set(key, category.id)

      // Also store by just the category name for fallback
      if (!categoryMap.has(category.name.toLowerCase())) {
        categoryMap.set(category.name.toLowerCase(), category.id)
      }
    }

    console.log('   Available categories:')
    for (const category of leafCategories) {
      console.log(`     - ${category.hierarchy}/${category.name} (${category.productCount || 0} products)`)
    }

    // Get all products
    const productsResult = await session.run(`
      MATCH (p:Product)
      OPTIONAL MATCH (p)-[:HAS_CATEGORY]->(c:Category)
      RETURN p.id as id, p.name as name, p.brand as brand, p.gender as gender,
             collect(c.id) as existingCategories
    `)

    console.log(`\n   Found ${productsResult.records.length} products to process`)

    for (const record of productsResult.records) {
      const productId = record.get('id')
      const productName = record.get('name').toLowerCase()
      const productBrand = record.get('brand')
      const productGender = record.get('gender')
      const existingCategories = record.get('existingCategories')

      // Skip if already assigned to a category
      if (existingCategories && existingCategories.length > 0) {
        continue
      }

      // Determine category based on product name and gender
      let categoryId: string | undefined
      let assignmentReason = ''

      // Hierarchy mapping based on gender
      let hierarchy = 'gents'
      if (productGender === 'WOMEN') {
        hierarchy = 'ladies'
      } else if (productGender === 'UNISEX') {
        hierarchy = 'gents' // Default unisex to gents
      }

      // Category detection logic
      if (productName.includes('belt')) {
        categoryId = categoryMap.get(`${hierarchy}:belts`) || categoryMap.get('belts')
        assignmentReason = 'Contains "belt"'
      } else if (productName.includes('dress')) {
        categoryId = categoryMap.get('ladies:dresses') || categoryMap.get('dresses')
        assignmentReason = 'Contains "dress"'
      } else if (productName.includes('blouse')) {
        categoryId = categoryMap.get('ladies:blouses') || categoryMap.get('blouses')
        assignmentReason = 'Contains "blouse"'
      } else if (productName.includes('polo')) {
        categoryId = categoryMap.get(`${hierarchy}:polo shirts`) || categoryMap.get('polo shirts')
        assignmentReason = 'Contains "polo"'
      } else if (productName.includes('shirt') || productName.includes('t-shirt') || productName.includes('tee')) {
        categoryId = categoryMap.get(`${hierarchy}:t-shirts`) || categoryMap.get(`${hierarchy}:shirts`) || categoryMap.get('t-shirts') || categoryMap.get('shirts')
        assignmentReason = 'Contains "shirt" or "tee"'
      } else if (productName.includes('chino')) {
        categoryId = categoryMap.get(`${hierarchy}:pants`) || categoryMap.get('pants')
        assignmentReason = 'Contains "chino"'
      } else if (productName.includes('pant') || productName.includes('trouser') || productName.includes('jean')) {
        categoryId = categoryMap.get(`${hierarchy}:pants`) || categoryMap.get(`${hierarchy}:jeans`) || categoryMap.get('pants') || categoryMap.get('jeans')
        assignmentReason = 'Contains "pant", "trouser", or "jean"'
      } else if (productName.includes('skirt')) {
        categoryId = categoryMap.get('ladies:skirts') || categoryMap.get('skirts')
        assignmentReason = 'Contains "skirt"'
      } else if (productName.includes('short')) {
        categoryId = categoryMap.get(`${hierarchy}:shorts`) || categoryMap.get('shorts')
        assignmentReason = 'Contains "short"'
      } else if (productName.includes('jacket') || productName.includes('coat') || productName.includes('blazer') || productName.includes('bomber')) {
        categoryId = categoryMap.get(`${hierarchy}:outerwear`) || categoryMap.get('outerwear')
        assignmentReason = 'Contains "jacket", "coat", or "blazer"'
      } else if (productName.includes('sweater') || productName.includes('cardigan') || productName.includes('pullover')) {
        categoryId = categoryMap.get(`${hierarchy}:sweaters`) || categoryMap.get('sweaters')
        assignmentReason = 'Contains "sweater" or "cardigan"'
      } else if (productName.includes('sneaker')) {
        categoryId = categoryMap.get(`${hierarchy}:sneakers`) || categoryMap.get('sneakers')
        assignmentReason = 'Contains "sneaker"'
      } else if (productName.includes('boot')) {
        categoryId = categoryMap.get(`${hierarchy}:boots`) || categoryMap.get('boots')
        assignmentReason = 'Contains "boot"'
      } else if (productName.includes('shoe')) {
        categoryId = categoryMap.get(`${hierarchy}:formal shoes`) || categoryMap.get(`${hierarchy}:sneakers`) || categoryMap.get('formal shoes')
        assignmentReason = 'Contains "shoe"'
      } else if (productName.includes('sandal') || productName.includes('slipper') || productName.includes('flip-flop')) {
        categoryId = categoryMap.get(`${hierarchy}:sandals`) || categoryMap.get('sandals')
        assignmentReason = 'Contains "sandal" or "slipper"'
      } else if (productName.includes('heel')) {
        categoryId = categoryMap.get('ladies:heels') || categoryMap.get('heels')
        assignmentReason = 'Contains "heel"'
      } else if (productName.includes('flat')) {
        categoryId = categoryMap.get('ladies:flats') || categoryMap.get('flats')
        assignmentReason = 'Contains "flat"'
      } else if (productName.includes('bag') || productName.includes('backpack') || productName.includes('purse') || productName.includes('crossbody')) {
        categoryId = categoryMap.get(`${hierarchy}:bags`) || categoryMap.get('bags')
        assignmentReason = 'Contains "bag" or "backpack"'
      } else if (productName.includes('watch')) {
        categoryId = categoryMap.get(`${hierarchy}:watches`) || categoryMap.get('watches')
        assignmentReason = 'Contains "watch"'
      } else if (productName.includes('hat') || productName.includes('cap')) {
        categoryId = categoryMap.get(`${hierarchy}:hats`) || categoryMap.get('hats')
        assignmentReason = 'Contains "hat" or "cap"'
      } else if (productName.includes('sock')) {
        categoryId = categoryMap.get(`${hierarchy}:socks`) || categoryMap.get('socks')
        assignmentReason = 'Contains "sock"'
      } else if (productName.includes('underwear') || productName.includes('brief')) {
        categoryId = categoryMap.get(`${hierarchy}:underwear`) || categoryMap.get('underwear')
        assignmentReason = 'Contains "underwear" or "brief"'
      } else if (productName.includes('suit')) {
        categoryId = categoryMap.get(`${hierarchy}:suits`) || categoryMap.get('suits')
        assignmentReason = 'Contains "suit"'
      } else if (productName.includes('jewelry') || productName.includes('necklace') || productName.includes('bracelet') || productName.includes('earring')) {
        categoryId = categoryMap.get('ladies:jewelry') || categoryMap.get('jewelry')
        assignmentReason = 'Contains "jewelry" or accessories'
      }

      if (categoryId) {
        try {
          await assignProductToCategories(session, productId, [categoryId])
          stats.productsAssignedToCategories++
          console.log(`   ✓ "${record.get('name')}" → Category (${assignmentReason})`)
        } catch (error) {
          const errorMsg = `Failed to assign product "${record.get('name')}": ${error}`
          console.error(`   ✗ ${errorMsg}`)
          stats.errors.push(errorMsg)
        }
      } else {
        console.log(`   ⚠ Could not determine category for: "${record.get('name')}" (${productBrand})`)
      }
    }

    console.log(`   ✓ Assigned ${stats.productsAssignedToCategories} products to categories`)

  } catch (error) {
    const errorMsg = `Failed to assign products to categories: ${error}`
    console.error(`   ✗ ${errorMsg}`)
    stats.errors.push(errorMsg)
  } finally {
    await session.close()
  }
}

/**
 * Main cleanup function
 */
async function runCleanup() {
  console.log('🧹 Starting Database Cleanup...\n')
  console.log('=' .repeat(60))

  try {
    await deleteCustomFilters()
    await removeDuplicateProducts()
    await assignProductsToCategories()

    console.log('\n' + '='.repeat(60))
    console.log('📊 Cleanup Summary:')
    console.log('='.repeat(60))
    console.log(`CustomFilter nodes deleted:     ${stats.customFiltersDeleted}`)
    console.log(`Duplicate products deleted:     ${stats.duplicateProductsDeleted}`)
    console.log(`Duplicate variants deleted:     ${stats.duplicateVariantsDeleted}`)
    console.log(`Products assigned to categories: ${stats.productsAssignedToCategories}`)

    if (stats.errors.length > 0) {
      console.log(`\n⚠️  Errors encountered: ${stats.errors.length}`)
      stats.errors.forEach((error, index) => {
        console.log(`  ${index + 1}. ${error}`)
      })
    } else {
      console.log('\n✅ Cleanup completed successfully with no errors!')
    }

  } catch (error) {
    console.error('\n❌ Fatal error during cleanup:', error)
    process.exit(1)
  } finally {
    await closeDriver()
  }
}

// Run the cleanup
runCleanup()
