#!/usr/bin/env tsx
/**
 * Setup Classic Clothing Category Hierarchy
 *
 * Creates a comprehensive clothing category system with three main hierarchies:
 * - Ladies (Women's Clothing)
 * - Gents (Men's Clothing)
 * - Kids (Children's Clothing)
 *
 * Structure follows industry-standard clothing categorization
 * with single-parent tree relationships.
 *
 * Usage: npm run setup:categories
 */

import dotenv from 'dotenv'
import { getSession } from '../src/lib/db'
import {
  createCategory,
  getCategoryTree
} from '../src/lib/repositories/category.repository'

// Load environment variables
dotenv.config({ path: '.env.local' })

interface CategoryDef {
  name: string
  featured?: boolean
  children?: CategoryDef[]
}

/**
 * Classic Clothing Category Structure
 * Structure: Root Categories (Ladies/Gents/Kids) at L0, then subcategories below
 */
const CATEGORIES: CategoryDef[] = [
  {
    name: 'Ladies',
    featured: true,
    children: [
      {
        name: 'Tops',
        featured: true,
        children: [
          { name: 'T-Shirts' },
          { name: 'Blouses' },
          { name: 'Shirts' },
          { name: 'Sweaters' },
          { name: 'Hoodies' },
          { name: 'Tank Tops' },
          { name: 'Crop Tops' }
        ]
      },
      {
        name: 'Bottoms',
        featured: true,
        children: [
          { name: 'Jeans' },
          { name: 'Trousers' },
          { name: 'Shorts' },
          { name: 'Skirts' },
          { name: 'Leggings' },
          { name: 'Culottes' }
        ]
      },
      {
        name: 'Dresses',
        featured: true,
        children: [
          { name: 'Casual Dresses' },
          { name: 'Evening Dresses' },
          { name: 'Maxi Dresses' },
          { name: 'Midi Dresses' },
          { name: 'Mini Dresses' },
          { name: 'Shirt Dresses' }
        ]
      },
      {
        name: 'Outerwear',
        children: [
          { name: 'Jackets' },
          { name: 'Coats' },
          { name: 'Blazers' },
          { name: 'Cardigans' },
          { name: 'Vests' }
        ]
      },
      {
        name: 'Activewear',
        children: [
          { name: 'Sports Bras' },
          { name: 'Yoga Pants' },
          { name: 'Track Pants' },
          { name: 'Athletic Tops' },
          { name: 'Athletic Shorts' }
        ]
      },
      {
        name: 'Innerwear',
        children: [
          { name: 'Bras' },
          { name: 'Panties' },
          { name: 'Shapewear' },
          { name: 'Camisoles' }
        ]
      },
      {
        name: 'Sleepwear',
        children: [
          { name: 'Pajamas' },
          { name: 'Nightgowns' },
          { name: 'Robes' }
        ]
      },
      {
        name: 'Footwear',
        featured: true,
        children: [
          { name: 'Heels' },
          { name: 'Flats' },
          { name: 'Sneakers' },
          { name: 'Boots' },
          { name: 'Sandals' },
          { name: 'Wedges' }
        ]
      },
      {
        name: 'Accessories',
        children: [
          { name: 'Bags & Purses' },
          { name: 'Jewelry' },
          { name: 'Scarves' },
          { name: 'Belts' },
          { name: 'Hats & Caps' },
          { name: 'Sunglasses' }
        ]
      }
    ]
  },
  {
    name: 'Gents',
    featured: true,
    children: [
      {
        name: 'Tops',
        featured: true,
        children: [
          { name: 'T-Shirts' },
          { name: 'Shirts' },
          { name: 'Polo Shirts' },
          { name: 'Sweaters' },
          { name: 'Hoodies' },
          { name: 'Tank Tops' },
          { name: 'Sweatshirts' }
        ]
      },
      {
        name: 'Bottoms',
        featured: true,
        children: [
          { name: 'Jeans' },
          { name: 'Trousers' },
          { name: 'Chinos' },
          { name: 'Shorts' },
          { name: 'Track Pants' },
          { name: 'Cargo Pants' }
        ]
      },
      {
        name: 'Formal Wear',
        featured: true,
        children: [
          { name: 'Suits' },
          { name: 'Dress Shirts' },
          { name: 'Dress Pants' },
          { name: 'Blazers' },
          { name: 'Ties & Bowties' },
          { name: 'Waistcoats' }
        ]
      },
      {
        name: 'Outerwear',
        children: [
          { name: 'Jackets' },
          { name: 'Coats' },
          { name: 'Bomber Jackets' },
          { name: 'Denim Jackets' },
          { name: 'Vests' }
        ]
      },
      {
        name: 'Activewear',
        children: [
          { name: 'Track Suits' },
          { name: 'Sports Shorts' },
          { name: 'Athletic Tops' },
          { name: 'Gym Vests' }
        ]
      },
      {
        name: 'Innerwear',
        children: [
          { name: 'Briefs' },
          { name: 'Boxers' },
          { name: 'Trunks' },
          { name: 'Vests' }
        ]
      },
      {
        name: 'Sleepwear',
        children: [
          { name: 'Pajamas' },
          { name: 'Lounge Pants' },
          { name: 'Robes' }
        ]
      },
      {
        name: 'Footwear',
        featured: true,
        children: [
          { name: 'Sneakers' },
          { name: 'Formal Shoes' },
          { name: 'Boots' },
          { name: 'Sandals & Slippers' },
          { name: 'Sports Shoes' },
          { name: 'Loafers' }
        ]
      },
      {
        name: 'Accessories',
        children: [
          { name: 'Belts' },
          { name: 'Wallets' },
          { name: 'Bags & Backpacks' },
          { name: 'Caps & Hats' },
          { name: 'Sunglasses' },
          { name: 'Watches' }
        ]
      }
    ]
  },
  {
    name: 'Kids',
    featured: true,
    children: [
      {
        name: 'Boys',
        featured: true,
        children: [
          {
            name: 'Tops',
            children: [
              { name: 'T-Shirts' },
              { name: 'Shirts' },
              { name: 'Hoodies' },
              { name: 'Sweaters' }
            ]
          },
          {
            name: 'Bottoms',
            children: [
              { name: 'Jeans' },
              { name: 'Shorts' },
              { name: 'Track Pants' },
              { name: 'Trousers' }
            ]
          },
          {
            name: 'Outerwear',
            children: [
              { name: 'Jackets' },
              { name: 'Coats' }
            ]
          }
        ]
      },
      {
        name: 'Girls',
        featured: true,
        children: [
          {
            name: 'Tops',
            children: [
              { name: 'T-Shirts' },
              { name: 'Blouses' },
              { name: 'Hoodies' },
              { name: 'Sweaters' }
            ]
          },
          {
            name: 'Bottoms',
            children: [
              { name: 'Jeans' },
              { name: 'Shorts' },
              { name: 'Skirts' },
              { name: 'Leggings' }
            ]
          },
          {
            name: 'Dresses',
            children: [
              { name: 'Casual Dresses' },
              { name: 'Party Dresses' }
            ]
          },
          {
            name: 'Outerwear',
            children: [
              { name: 'Jackets' },
              { name: 'Coats' }
            ]
          }
        ]
      },
      {
        name: 'Footwear',
        featured: true,
        children: [
          { name: 'Sneakers' },
          { name: 'Sandals' },
          { name: 'Boots' },
          { name: 'School Shoes' },
          { name: 'Slippers' }
        ]
      },
      {
        name: 'Accessories',
        children: [
          { name: 'Bags & Backpacks' },
          { name: 'Caps & Hats' },
          { name: 'Belts' },
          { name: 'Socks' }
        ]
      },
      {
        name: 'Sleepwear',
        children: [
          { name: 'Pajamas' },
          { name: 'Nightgowns' },
          { name: 'Onesies' }
        ]
      }
    ]
  }
]

/**
 * Recursively create category and its children
 */
async function createCategoryTree(
  session: any,
  hierarchy: 'ladies' | 'gents' | 'kids',
  def: CategoryDef,
  parentId: string | null = null,
  depth: number = 0
): Promise<void> {
  try {
    // Create this category
    const category = await createCategory(
      session,
      def.name,
      hierarchy,
      parentId,
      def.featured || false
    )

    const indent = '  '.repeat(depth)
    const featuredMark = def.featured ? ' ⭐' : ''
    console.log(`${indent}✓ ${def.name} (L${category.level})${featuredMark}`)

    // Create children recursively
    if (def.children) {
      for (const child of def.children) {
        await createCategoryTree(session, hierarchy, child, category.id, depth + 1)
      }
    }
  } catch (error: any) {
    // Skip if already exists
    if (error.message?.includes('already exists')) {
      const indent = '  '.repeat(depth)
      console.log(`${indent}⊗ ${def.name} (already exists)`)
    } else {
      throw error
    }
  }
}

/**
 * Display category tree in console
 */
function displayTree(categories: any[], depth: number = 0): void {
  for (const cat of categories) {
    const indent = '  '.repeat(depth)
    const featured = cat.isFeatured ? ' ⭐' : ''
    const products = cat.productCount ? ` (${cat.productCount} products)` : ''
    console.log(`${indent}├─ ${cat.name} [L${cat.level}]${featured}${products}`)

    if (cat.children?.length > 0) {
      displayTree(cat.children, depth + 1)
    }
  }
}

/**
 * Main setup function
 */
async function setupCategories() {
  const session = getSession()

  try {
    console.log('\n🏗️  Setting up Classic Clothing Category Hierarchy\n')
    console.log('═══════════════════════════════════════════════════\n')

    // Create each top-level category (Ladies, Gents, Kids)
    for (const rootCategoryDef of CATEGORIES) {
      const hierarchy = rootCategoryDef.name.toLowerCase() as 'ladies' | 'gents' | 'kids'

      console.log(`\n📦 ${rootCategoryDef.name.toUpperCase()}:`)
      console.log('─'.repeat(40))

      await createCategoryTree(
        session,
        hierarchy,
        rootCategoryDef
      )
    }

    // Display final tree
    console.log('\n\n✅ Category hierarchy created successfully!\n')
    console.log('═══════════════════════════════════════════════════\n')
    console.log('📊 Complete Category Structure:\n')

    const tree = await getCategoryTree(session)

    // Display the root categories (Ladies, Gents, Kids) and their children
    for (const [hierarchy, categories] of Object.entries(tree)) {
      if (categories.length > 0) {
        const rootCategory = categories[0]
        console.log(`\n${hierarchy.toUpperCase()} - ${rootCategory.name} (L${rootCategory.level}) ${rootCategory.isFeatured ? '⭐' : ''}`)
        if (rootCategory.children?.length > 0) {
          displayTree(rootCategory.children, 1)
        }
      }
    }

    console.log('\n\n✨ Next Steps:')
    console.log('   • View categories at: /admin/categories')
    console.log('   • Assign products to leaf categories')
    console.log('   • Categories marked with ⭐ appear in navigation\n')

  } catch (error) {
    console.error('\n❌ Error setting up categories:', error)
    throw error
  } finally {
    await session.close()
  }
}

// Run the script
if (require.main === module) {
  setupCategories()
    .then(() => {
      console.log('✅ Script completed successfully\n')
      process.exit(0)
    })
    .catch((error) => {
      console.error('❌ Script failed:', error)
      process.exit(1)
    })
}

export { setupCategories }
