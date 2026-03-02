/**
 * Seed Hero Slides
 *
 * Uploads default hero background images to MinIO and creates HeroSlide nodes in Neo4j.
 * Run with: npm run seed:hero-slides
 */

import dotenv from 'dotenv'
import fs from 'fs'
import path from 'path'
import { getSession, closeDriver } from '../src/lib/db'
import { uploadFile, initializeBucket } from '../src/lib/minio'
import * as heroSlideRepo from '../src/lib/repositories/hero-slide.repository'
import type { HeroAnimationType } from '../src/lib/types'

// Load environment variables
dotenv.config({ path: '.env.local' })

interface DefaultSlide {
  imageFile: string
  animationType: HeroAnimationType
  badgeText: string
  title: string
  subtitle: string
}

const DEFAULT_SLIDES: DefaultSlide[] = [
  {
    imageFile: 'hero-bg.jpg',
    animationType: 'left-panel',
    badgeText: 'Premium Experience closer to You',
    title: 'Ecom',
    subtitle: 'Branded Clothing at Stock Prices',
  },
  {
    imageFile: 'hero-bg-2.jpg',
    animationType: 'top-left-round',
    badgeText: 'Premium Experience closer to You',
    title: 'Ecom',
    subtitle: 'Branded Clothing at Stock Prices',
  },
  {
    imageFile: 'hero-bg-3.jpg',
    animationType: 'top-right-panel',
    badgeText: 'Premium Experience closer to You',
    title: 'Ecom',
    subtitle: 'Branded Clothing at Stock Prices',
  },
  {
    imageFile: 'hero-bg-4.jpg',
    animationType: 'bottom-right-quarter',
    badgeText: 'Premium Experience closer to You',
    title: 'Ecom',
    subtitle: 'Branded Clothing at Stock Prices',
  },
]

export async function seedHeroSlides() {
  console.log('\n🖼️  Seeding hero slides...')

  const session = getSession()

  try {
    // Check if hero slides already exist
    const existing = await heroSlideRepo.getAllHeroSlides(session)
    if (existing.length > 0) {
      console.log(`   ⏭️  Skipped: ${existing.length} hero slides already exist`)
      return
    }

    // Ensure MinIO bucket exists
    await initializeBucket()

    let created = 0

    for (let i = 0; i < DEFAULT_SLIDES.length; i++) {
      const slide = DEFAULT_SLIDES[i]
      const imagePath = path.join(process.cwd(), 'public', 'images', slide.imageFile)

      // Check if image file exists
      if (!fs.existsSync(imagePath)) {
        console.log(`   ⚠️  Skipped: ${slide.imageFile} not found in public/images/`)
        continue
      }

      // Read image file and upload to MinIO
      const imageBuffer = fs.readFileSync(imagePath)
      const imageUrl = await uploadFile(imageBuffer, slide.imageFile, 'image/jpeg')

      // Create HeroSlide node in Neo4j
      await heroSlideRepo.createHeroSlide(session, {
        imageUrl,
        animationType: slide.animationType,
        badgeText: slide.badgeText,
        title: slide.title,
        subtitle: slide.subtitle,
        displayOrder: i,
        isActive: true,
      })

      console.log(`   ✅ Created slide ${i + 1}: ${slide.animationType} (${slide.imageFile})`)
      created++
    }

    console.log(`\n   📊 Summary: ${created} hero slides created`)
  } catch (error) {
    console.error('   ❌ Error seeding hero slides:', error)
    throw error
  } finally {
    await session.close()
  }
}

// Allow running standalone
if (require.main === module) {
  seedHeroSlides()
    .then(() => {
      console.log('\n✅ Hero slides seeding completed!')
    })
    .catch((error) => {
      console.error('\n❌ Hero slides seeding failed:', error)
      process.exit(1)
    })
    .finally(async () => {
      await closeDriver()
    })
}
