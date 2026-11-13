/**
 * Seed Sinhala hero-slide copy (LKD-41)
 *
 * Sets the optional titleSi/subtitleSi/badgeTextSi properties on the live
 * LOCKED campaign hero slides (seeded by seed-locked-v4) so the /si storefront
 * renders Sinhala copy. English fields are NEVER touched — they stay the
 * fallback for /en and for any slide without Si copy.
 *
 * Idempotent: matches slides by their ENGLISH title, so re-running updates the
 * Si copy in place and leaves everything else (order, images, activity) alone.
 *
 * Run with: npm run seed:hero-si
 */

import dotenv from 'dotenv'
import { internal } from '@softx/engine'

const { getSession, closeDriver } = internal.db

dotenv.config({ path: '.env.local' })

/**
 * Sinhala copy for the live LOCKED campaign slides, tone-matched to
 * messages/si.json (home.hero.*: "තොග මිලට සන්නාම ඇඳුම්" etc.). The LOCKED
 * brand name stays in English, mirroring si.json's common.appName = "LOCKED".
 */
const SI_COPY: { enTitle: string; titleSi: string; subtitleSi: string; badgeTextSi: string }[] = [
  {
    enTitle: 'LOCKED Holiday Collection',
    titleSi: 'නිවාඩු කාලීන එකතුව',
    subtitleSi: 'සතුට මගෙ සමඟ',
    badgeTextSi: 'අලුත් එකතුවක්',
  },
  {
    enTitle: 'LOCKED Elegance Collection',
    titleSi: 'විලාසිතාවන්ගේ එකතුව',
    subtitleSi: 'සුවපහසු බව මගෙ සමඟ',
    badgeTextSi: 'සංස්කරණය',
  },
  {
    enTitle: 'LOCKED Essentials',
    titleSi: 'අත්‍යවශ්‍ය එකතුව',
    subtitleSi: 'එදිනෙදා ජීවිතයටම',
    badgeTextSi: 'අත්‍යවශ්‍ය',
  },
  {
    enTitle: 'LOCKED Outerwear',
    titleSi: 'සීතල කාලීන ඇඳුම්',
    subtitleSi: 'කාලයට සරිලන ලෙස',
    badgeTextSi: 'පිටත ඇඳුම්',
  },
  {
    enTitle: 'LOCKED After Hours',
    titleSi: 'රාත්‍රී කාලයේ',
    subtitleSi: 'නගරය කිසිදා නිදා නොගනී',
    badgeTextSi: 'රාත්‍රී ජීවන රටාව',
  },
  {
    enTitle: 'LOCKED Festive Edit',
    titleSi: 'උත්සව සමයේ එකතුව',
    subtitleSi: 'හැම නූලකම සුබ සාධනයෙන්',
    badgeTextSi: 'උත්සව සමය',
  },
]

export async function seedHeroSi() {
  console.log('\n🇱🇰  Seeding Sinhala hero-slide copy...')
  const session = getSession()

  try {
    let updated = 0
    let missing = 0

    for (const copy of SI_COPY) {
      const result = await session.run(
        `
        MATCH (h:HeroSlide {title: $enTitle})
        SET h.titleSi = $titleSi,
            h.subtitleSi = $subtitleSi,
            h.badgeTextSi = $badgeTextSi,
            h.updatedAt = $now
        RETURN count(h) AS matched
        `,
        { enTitle: copy.enTitle, titleSi: copy.titleSi, subtitleSi: copy.subtitleSi, badgeTextSi: copy.badgeTextSi, now: new Date().toISOString() }
      )

      const matched = result.records[0]?.get('matched')?.toNumber?.() ?? 0
      if (matched > 0) {
        console.log(`   ✅ ${copy.enTitle} → ${copy.titleSi} (${matched} slide${matched > 1 ? 's' : ''})`)
        updated += matched
      } else {
        console.log(`   ⏭️  No active slide titled "${copy.enTitle}" — skipped`)
        missing++
      }
    }

    console.log(`\n   📊 Summary: ${updated} slide(s) updated with Si copy, ${missing} title(s) not found`)
    if (missing > 0) {
      console.log('   (Titles come from seed-locked-v4.ts — run that seed first if slides are missing.)')
    }
  } catch (error) {
    console.error('   ❌ Error seeding Si hero copy:', error)
    throw error
  } finally {
    await session.close()
  }
}

// Allow running standalone
if (require.main === module) {
  seedHeroSi()
    .then(() => {
      console.log('\n✅ Sinhala hero-slide seeding completed!')
    })
    .catch((error) => {
      console.error('\n❌ Sinhala hero-slide seeding failed:', error)
      process.exit(1)
    })
    .finally(async () => {
      await closeDriver()
    })
}
