/**
 * Database Clear Script
 *
 * Clears all data from the database (except constraints and indexes).
 * Run with: npm run db:clear
 *
 * WARNING: This will delete ALL data in the database!
 */

import dotenv from 'dotenv'
import { getSession, closeDriver } from '../src/lib/db'
import * as readline from 'readline'

// Load environment variables
dotenv.config({ path: '.env.local' })

async function promptConfirmation(): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  })

  return new Promise((resolve) => {
    rl.question(
      '\n⚠️  WARNING: This will delete ALL data in the database!\n   Are you sure you want to continue? (yes/no): ',
      (answer) => {
        rl.close()
        resolve(answer.toLowerCase() === 'yes')
      }
    )
  })
}

async function clearDatabase() {
  console.log('🗑️  Database Clear Script')
  console.log('=' .repeat(60))

  // Prompt for confirmation
  const confirmed = await promptConfirmation()

  if (!confirmed) {
    console.log('\n❌ Operation cancelled.')
    process.exit(0)
  }

  console.log('\n🧹 Clearing database...')

  const session = getSession()

  try {
    // Get count of nodes before deletion
    const countResult = await session.run('MATCH (n) RETURN count(n) as count')
    const totalNodes = countResult.records[0].get('count').toNumber()

    console.log(`   Found ${totalNodes} nodes to delete...`)

    // Delete all nodes and relationships
    await session.run('MATCH (n) DETACH DELETE n')

    console.log('   ✅ All nodes and relationships deleted')

    console.log('\n' + '='.repeat(60))
    console.log('✅ Database cleared successfully!')
    console.log(`   Deleted ${totalNodes} nodes`)
    console.log('\n💡 Next steps:')
    console.log('   1. Run: npm run db:init (reinitialize schema)')
    console.log('   2. Run: npm run db:seed (create test users)')
    console.log('   3. Run: npm run setup:categories (setup category hierarchy)')

  } catch (error) {
    console.error('\n❌ Error clearing database:', error)
    process.exit(1)
  } finally {
    await session.close()
    await closeDriver()
  }
}

// Run the clear operation
clearDatabase()
