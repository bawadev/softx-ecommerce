/**
 * Database Seeding Script
 *
 * Creates default test users and sample data for development and testing.
 * Run with: npm run db:seed
 */

import dotenv from 'dotenv'
import { internal, createEngine, engineConfigFromEnv } from '@softx/engine'
import { seedHeroSlides } from './seed-hero-slides'

// Load environment variables
dotenv.config({ path: '.env.local' })

const { closeDriver } = internal.db

interface SeedUser {
  email: string
  password: string
  firstName: string
  lastName: string
  role: 'ADMIN' | 'CUSTOMER'
  phone?: string
}

const DEFAULT_USERS: SeedUser[] = [
  {
    email: 'testadmin@ecommerce.com',
    password: 'Admin123!',
    firstName: 'Test',
    lastName: 'Admin',
    role: 'ADMIN',
  },
  {
    email: 'test@example.com',
    password: 'Customer123!',
    firstName: 'Test',
    lastName: 'Customer',
    role: 'CUSTOMER',
  },
]

async function seedUsers() {
  console.log('\n👥 Seeding users...')

  // Users are created through the engine's account service so password
  // hashing is engine-owned (the app's lib/auth hash helpers are gone);
  // signUp CONFLICTs on an existing email, which this script treats as a skip.
  const account = createEngine(engineConfigFromEnv())
    .for({ clientId: process.env.CLIENT_ID || 'factorybay' })
    .account

  let created = 0
  let skipped = 0

  for (const userData of DEFAULT_USERS) {
    try {
      const r = await account.signUp({
        email: userData.email,
        password: userData.password,
        firstName: userData.firstName,
        lastName: userData.lastName,
        role: userData.role,
        ...(userData.phone !== undefined ? { phone: userData.phone } : {}),
      })

      if (!r.ok) {
        if (r.error.code === 'CONFLICT') {
          console.log(`   ⏭️  Skipped: ${userData.email} (already exists)`)
          skipped++
          continue
        }
        throw new Error(r.error.message)
      }

      console.log(`   ✅ Created: ${r.data.email} (${r.data.role})`)
      created++
    } catch (error) {
      console.error(`   ❌ Failed to create ${userData.email}:`, error)
    }
  }

  console.log(`\n   📊 Summary: ${created} created, ${skipped} skipped`)
}

async function seedDatabase() {
  console.log('🌱 Starting database seeding...')
  console.log('=' .repeat(60))

  try {
    await seedUsers()
    await seedHeroSlides()

    console.log('\n' + '='.repeat(60))
    console.log('✅ Database seeding completed successfully!')
    console.log('\n📋 Test Accounts:')
    console.log('   Admin:    testadmin@ecommerce.com / Admin123!')
    console.log('   Customer: test@example.com / Customer123!')
    console.log('\n🔗 URLs:')
    console.log('   App:   http://localhost:3000/en/login')
    console.log('   Admin: http://localhost:3000/en/admin/dashboard')

  } catch (error) {
    console.error('\n❌ Fatal error during seeding:', error)
    process.exit(1)
  } finally {
    await closeDriver()
  }
}

// Run the seeding
seedDatabase()
