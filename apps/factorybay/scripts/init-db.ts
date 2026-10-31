/**
 * Database Initialization Script
 *
 * Initializes Neo4j schema with constraints and indexes.
 * Run with: npm run db:init
 */

import dotenv from 'dotenv'
import { initializeSchema } from '../src/lib/schema'
import { closeDriver } from '../src/lib/db'

// Load environment variables
dotenv.config({ path: '.env.local' })

async function main() {
  console.log('🔧 Initializing Neo4j Database Schema')
  console.log('=' .repeat(60))

  try {
    await initializeSchema()

    console.log('\n' + '='.repeat(60))
    console.log('✅ Database schema initialized successfully!')
    console.log('\n💡 Next steps:')
    console.log('   1. Run: npm run db:seed (create test users)')
    console.log('   2. Run: npm run setup:categories (optional - setup category hierarchy)')
    console.log('   3. Run: npm run minio:init (optional - initialize MinIO bucket)')

  } catch (error) {
    console.error('\n❌ Error initializing schema:', error)
    process.exit(1)
  } finally {
    await closeDriver()
  }
}

main()
