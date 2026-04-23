/**
 * Seed LOCKED campaign v4 — multi-shot per product
 *
 * Differs from v3: each color option carries 3 shot filenames (A/B/C).
 * - A = primary/hero (card thumbnail + first in detail gallery)
 * - B = alt angle/pose (second in detail gallery)
 * - C = environmental (third in detail gallery)
 *
 * Product.images[] = [A, B, C] so the detail page's existing gallery
 * renders all three with thumbnail strip + prev/next navigation.
 * ProductVariant.images[] per color still holds that color's A-shot only,
 * so color-swatch switching shows the primary angle of the selected color.
 *
 * Run: npx tsx scripts/seed-locked-v4.ts
 */

import dotenv from 'dotenv'
import fs from 'fs'
import path from 'path'
import * as Minio from 'minio'
import { getSession, closeDriver } from '../src/lib/db'

dotenv.config({ path: '.env.local' })

const IMAGES_DIR = '/tmp/locked-images'
const BUCKET = process.env.MINIO_BUCKET_NAME || 'product-images'
const MINIO_PUBLIC_URL = process.env.NEXT_PUBLIC_MINIO_URL || 'https://cdn.locked.lk'

const minio = new Minio.Client({
  endPoint: process.env.MINIO_ENDPOINT || 'localhost',
  port: parseInt(process.env.MINIO_PORT || '9000'),
  useSSL: (process.env.MINIO_USE_SSL || 'false') === 'true',
  accessKey: process.env.MINIO_ACCESS_KEY!,
  secretKey: process.env.MINIO_SECRET_KEY!,
})

async function upload(localFile: string, objectName: string): Promise<string> {
  const buf = fs.readFileSync(path.join(IMAGES_DIR, localFile))
  await minio.putObject(BUCKET, objectName, buf, buf.length, {
    'Content-Type': 'image/webp',
  })
  return `${MINIO_PUBLIC_URL}/${BUCKET}/${objectName}`
}

// Heroes are unchanged from v3 — reuse existing images.
const heroSlides = [
  { fileDesktop: 'hero-1-holiday-desktop.webp', fileMobile: 'hero-1-holiday-mobile.webp', title: 'LOCKED Holiday Collection', subtitle: 'Locked in Joy', badgeText: 'NEW DROP', animationType: 'left-panel', mobileAnimationType: 'top-banner', colorTheme: 'dark', displayOrder: 0 },
  { fileDesktop: 'hero-2-elegance-desktop.webp', fileMobile: 'hero-2-elegance-mobile.webp', title: 'LOCKED Elegance Collection', subtitle: 'Locked in Luxury', badgeText: 'EDITORIAL', animationType: 'bottom-right-quarter', mobileAnimationType: 'bottom-pill', colorTheme: 'light', displayOrder: 1 },
  { fileDesktop: 'hero-3-essentials-desktop.webp', fileMobile: 'hero-3-essentials-mobile.webp', title: 'LOCKED Essentials', subtitle: 'Locked in the Everyday', badgeText: 'ESSENTIALS', animationType: 'top-right-panel', mobileAnimationType: 'bottom-full-panel', colorTheme: 'light', displayOrder: 2 },
  { fileDesktop: 'hero-4-outerwear-desktop.webp', fileMobile: 'hero-4-outerwear-mobile.webp', title: 'LOCKED Outerwear', subtitle: 'Built for the Seasons', badgeText: 'OUTERWEAR', animationType: 'top-left-round', mobileAnimationType: 'center-card', colorTheme: 'dark', displayOrder: 3 },
  { fileDesktop: 'hero-5-after-hours-desktop.webp', fileMobile: 'hero-5-after-hours-mobile.webp', title: 'LOCKED After Hours', subtitle: 'The City Never Sleeps', badgeText: 'NOCTURNAL', animationType: 'bottom-right-quarter', mobileAnimationType: 'bottom-pill', colorTheme: 'dark', displayOrder: 4 },
  { fileDesktop: 'hero-6-festive-desktop.webp', fileMobile: 'hero-6-festive-mobile.webp', title: 'LOCKED Festive Edit', subtitle: 'Warmth in Every Thread', badgeText: 'FESTIVE', animationType: 'left-panel', mobileAnimationType: 'top-banner', colorTheme: 'light', displayOrder: 5 },
]

interface ColorOption {
  color: string
  /** Shot A filename (primary, card thumbnail, first in gallery) */
  fileA: string
  /** Shot B filename (alt pose) */
  fileB: string
  /** Shot C filename (environmental) */
  fileC: string
  stockBySize: { [size: string]: number }
}

interface SeedProduct {
  name: string
  description: string
  sku: string
  gender: 'MEN' | 'WOMEN' | 'UNISEX'
  stockPrice: number
  retailPrice: number
  categoryPath: { hierarchy: 'ladies' | 'gents' | 'kids'; leaf: string }
  sizes: string[]
  colors: ColorOption[]
}

const products: SeedProduct[] = [
  {
    name: 'LOCKED Signature Oversized Tee',
    description: '240GSM premium cotton heavyweight tee with drop shoulders and a relaxed oversized fit. Bold LOCKED chest print. Pre-washed for a lived-in feel.',
    sku: 'LKD-TEE-OVS',
    gender: 'UNISEX',
    stockPrice: 3200,
    retailPrice: 4800,
    categoryPath: { hierarchy: 'gents', leaf: 'T-Shirts' },
    sizes: ['S', 'M', 'L', 'XL'],
    colors: [
      { color: 'Black', fileA: 'product-01-tshirt-oversized-black.webp', fileB: 'product-01-tshirt-oversized-black-b.webp', fileC: 'product-01-tshirt-oversized-black-c.webp', stockBySize: { S: 18, M: 24, L: 20, XL: 14 } },
      { color: 'Cream', fileA: 'product-02-tshirt-oversized-cream.webp', fileB: 'product-02-tshirt-oversized-cream-b.webp', fileC: 'product-02-tshirt-oversized-cream-c.webp', stockBySize: { S: 15, M: 22, L: 18, XL: 10 } },
    ],
  },
  {
    name: 'LOCKED Short-Sleeve Linen Shirt',
    description: 'Breathable pure-linen button-up designed for the Sri Lankan climate. Relaxed cut, half-open wear, woven LOCKED label at chest. Softens with every wash.',
    sku: 'LKD-LNS-SS',
    gender: 'UNISEX',
    stockPrice: 4800,
    retailPrice: 7200,
    categoryPath: { hierarchy: 'gents', leaf: 'Shirts' },
    sizes: ['S', 'M', 'L', 'XL'],
    colors: [
      { color: 'Sand', fileA: 'product-03-linen-shirt-sand.webp', fileB: 'product-03-linen-shirt-sand-b.webp', fileC: 'product-03-linen-shirt-sand-c.webp', stockBySize: { S: 10, M: 15, L: 12, XL: 8 } },
      { color: 'Navy', fileA: 'product-04-linen-shirt-navy.webp', fileB: 'product-04-linen-shirt-navy-b.webp', fileC: 'product-04-linen-shirt-navy-c.webp', stockBySize: { S: 9, M: 14, L: 11, XL: 7 } },
    ],
  },
  {
    name: 'LOCKED Tropical-Weight Hoodie',
    description: 'Lightweight French-terry LOCKED hoodie engineered for the tropics — weight of a tee, structure of a hoodie. Tonal embroidered chest logo.',
    sku: 'LKD-HDY-TW',
    gender: 'UNISEX',
    stockPrice: 5400,
    retailPrice: 8200,
    categoryPath: { hierarchy: 'ladies', leaf: 'Hoodies' },
    sizes: ['S', 'M', 'L', 'XL'],
    colors: [
      { color: 'Bone', fileA: 'product-05-hoodie-bone.webp', fileB: 'product-05-hoodie-bone-b.webp', fileC: 'product-05-hoodie-bone-c.webp', stockBySize: { S: 8, M: 14, L: 12, XL: 6 } },
      { color: 'Charcoal', fileA: 'product-06-hoodie-charcoal.webp', fileB: 'product-06-hoodie-charcoal-b.webp', fileC: 'product-06-hoodie-charcoal-c.webp', stockBySize: { S: 10, M: 16, L: 14, XL: 8 } },
    ],
  },
  {
    name: 'LOCKED Crewneck Sweatshirt — Olive',
    description: '320GSM loopback fleece crewneck in deep olive. Tonal LOCKED chest embroidery, ribbed trims, relaxed fit.',
    sku: 'LKD-CRW-OLV',
    gender: 'UNISEX',
    stockPrice: 4800,
    retailPrice: 7200,
    categoryPath: { hierarchy: 'ladies', leaf: 'Sweaters' },
    sizes: ['S', 'M', 'L', 'XL'],
    colors: [
      { color: 'Olive', fileA: 'product-07-crewneck-olive.webp', fileB: 'product-07-crewneck-olive-b.webp', fileC: 'product-07-crewneck-olive-c.webp', stockBySize: { S: 10, M: 16, L: 14, XL: 8 } },
    ],
  },
  {
    name: 'LOCKED Tactical Cargo Pants — Black',
    description: 'Mid-weight cotton twill cargos. Tapered leg, six-pocket layout, woven LOCKED hip tag. Built for city movement.',
    sku: 'LKD-CRG-BLK',
    gender: 'UNISEX',
    stockPrice: 5400,
    retailPrice: 7800,
    categoryPath: { hierarchy: 'gents', leaf: 'Cargo Pants' },
    sizes: ['30', '32', '34', '36'],
    colors: [
      { color: 'Black', fileA: 'product-08-cargo-pants-black.webp', fileB: 'product-08-cargo-pants-black-b.webp', fileC: 'product-08-cargo-pants-black-c.webp', stockBySize: { '30': 10, '32': 14, '34': 12, '36': 8 } },
    ],
  },
  {
    name: 'LOCKED Wide-Leg Trousers — Cream',
    description: 'Relaxed wide-leg trousers in premium cotton. High rise, pleated front, clean drape. Paired easily from casual to dressy.',
    sku: 'LKD-WLT-CRM',
    gender: 'WOMEN',
    stockPrice: 5200,
    retailPrice: 7800,
    categoryPath: { hierarchy: 'ladies', leaf: 'Trousers' },
    sizes: ['XS', 'S', 'M', 'L'],
    colors: [
      { color: 'Cream', fileA: 'product-09-wide-leg-trousers-cream.webp', fileB: 'product-09-wide-leg-trousers-cream-b.webp', fileC: 'product-09-wide-leg-trousers-cream-c.webp', stockBySize: { XS: 6, S: 10, M: 14, L: 8 } },
    ],
  },
  {
    name: 'LOCKED Bucket Hat — Black',
    description: 'Heavyweight cotton bucket hat with structured crown. Raised cream LOCKED+padlock embroidery on the front. One size.',
    sku: 'LKD-HAT-BKT',
    gender: 'UNISEX',
    stockPrice: 2400,
    retailPrice: 3600,
    categoryPath: { hierarchy: 'gents', leaf: 'Caps & Hats' },
    sizes: ['One Size'],
    colors: [
      { color: 'Black', fileA: 'product-10-bucket-hat-black.webp', fileB: 'product-10-bucket-hat-black-b.webp', fileC: 'product-10-bucket-hat-black-c.webp', stockBySize: { 'One Size': 40 } },
    ],
  },
  {
    name: 'LOCKED Denim Trucker Jacket — Washed Indigo',
    description: 'Classic trucker jacket in washed 14oz indigo denim. LOCKED chain-stitch chest embroidery, flap chest pockets, boxy relaxed cut.',
    sku: 'LKD-DNM-WSH',
    gender: 'UNISEX',
    stockPrice: 7800,
    retailPrice: 11500,
    categoryPath: { hierarchy: 'gents', leaf: 'Denim Jackets' },
    sizes: ['S', 'M', 'L', 'XL'],
    colors: [
      { color: 'Washed Indigo', fileA: 'product-11-denim-jacket-washed.webp', fileB: 'product-11-denim-jacket-washed-b.webp', fileC: 'product-11-denim-jacket-washed-c.webp', stockBySize: { S: 6, M: 10, L: 8, XL: 4 } },
    ],
  },
  {
    name: 'LOCKED Cotton Maxi Dress — Rust',
    description: 'A-line cotton maxi dress in earthy rust. Flowy silhouette, LOCKED woven label at the hip. Climate-appropriate effortless elegance.',
    sku: 'LKD-DRS-RST',
    gender: 'WOMEN',
    stockPrice: 6400,
    retailPrice: 9800,
    categoryPath: { hierarchy: 'ladies', leaf: 'Maxi Dresses' },
    sizes: ['XS', 'S', 'M', 'L'],
    colors: [
      { color: 'Rust', fileA: 'product-12-cotton-maxi-dress-rust.webp', fileB: 'product-12-cotton-maxi-dress-rust-b.webp', fileC: 'product-12-cotton-maxi-dress-rust-c.webp', stockBySize: { XS: 5, S: 9, M: 12, L: 7 } },
    ],
  },
]

async function findLeafCategoryId(session: any, hierarchy: string, leaf: string): Promise<string | null> {
  const res = await session.run(
    `MATCH (c:Category {hierarchy: $hierarchy, name: $name}) RETURN c.id AS id LIMIT 1`,
    { hierarchy, name: leaf }
  )
  return res.records.length ? res.records[0].get('id') : null
}

async function clearOld(session: any) {
  console.log('\n🧹 Clearing old content...')
  await session.run(`MATCH (h:HeroSlide) DETACH DELETE h`)
  await session.run(
    `MATCH (p:Product) WHERE p.brand IN ['Locked', 'LOCKED']
     OPTIONAL MATCH (v:ProductVariant)-[:VARIANT_OF]->(p)
     DETACH DELETE p, v`
  )
  await session.run(
    `MATCH (c:CartItem) WHERE NOT EXISTS { (c)-[:CART_ITEM_FOR]->(:ProductVariant) } DETACH DELETE c`
  )
  await session.run(
    `MATCH (v:ProductVariant) WHERE NOT EXISTS { (v)-[:VARIANT_OF]->(:Product) } DETACH DELETE v`
  )
  console.log('   ✓ Cleared heroes, LOCKED products, orphan variants, orphan cart items')
}

async function seedHero(session: any) {
  console.log('\n🖼️  Seeding hero slides...')
  for (const h of heroSlides) {
    const desktopUrl = await upload(h.fileDesktop, h.fileDesktop)
    const mobileUrl = await upload(h.fileMobile, h.fileMobile)
    const id = `hero-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    const now = new Date().toISOString()
    await session.run(
      `CREATE (h:HeroSlide {
        id: $id, imageUrl: $imageUrl, mobileImageUrl: $mobileImageUrl,
        title: $title, subtitle: $subtitle, badgeText: $badgeText,
        animationType: $animationType, mobileAnimationType: $mobileAnimationType,
        colorTheme: $colorTheme, displayOrder: $displayOrder,
        isActive: true, createdAt: $now, updatedAt: $now
      })`,
      { id, imageUrl: desktopUrl, mobileImageUrl: mobileUrl, title: h.title, subtitle: h.subtitle, badgeText: h.badgeText, animationType: h.animationType, mobileAnimationType: h.mobileAnimationType, colorTheme: h.colorTheme, displayOrder: h.displayOrder, now }
    )
    console.log(`   ✓ ${h.title}`)
  }
}

async function seedProducts(session: any) {
  console.log('\n👕 Seeding products + 3-shot galleries + color variants...')

  for (const p of products) {
    // Upload all 3 shots for each color and collect URLs
    const colorData: { color: string; aUrl: string; bUrl: string; cUrl: string; stockBySize: ColorOption['stockBySize'] }[] = []
    for (const c of p.colors) {
      const aUrl = await upload(c.fileA, c.fileA)
      const bUrl = await upload(c.fileB, c.fileB)
      const cUrl = await upload(c.fileC, c.fileC)
      colorData.push({ color: c.color, aUrl, bUrl, cUrl, stockBySize: c.stockBySize })
    }

    // Primary product gallery = [A, B, C] of the first (canonical) color.
    // The detail page's existing gallery component uses this array for
    // thumbnails + prev/next navigation.
    const primary = colorData[0]
    const productImages = [primary.aUrl, primary.bUrl, primary.cUrl]

    const productId = `prod-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    const now = new Date().toISOString()

    await session.run(
      `CREATE (p:Product {
        id: $id, name: $name, description: $description, brand: 'LOCKED',
        gender: $gender, stockPrice: $stockPrice, retailPrice: $retailPrice,
        sku: $sku, images: $images, createdAt: $now, updatedAt: $now
      })`,
      { id: productId, name: p.name, description: p.description, gender: p.gender, stockPrice: p.stockPrice, retailPrice: p.retailPrice, sku: p.sku, images: productImages, now }
    )

    const leafId = await findLeafCategoryId(session, p.categoryPath.hierarchy, p.categoryPath.leaf)
    if (leafId) {
      await session.run(
        `MATCH (p:Product {id: $productId}), (c:Category {id: $leafId})
         MERGE (p)-[:HAS_CATEGORY]->(c)`,
        { productId, leafId }
      )
    } else {
      console.log(`   ⚠  Category not found: ${p.categoryPath.hierarchy}/${p.categoryPath.leaf}`)
    }

    // Variants: for non-primary colors, store that color's A-shot as variant.images[0]
    // so color-swatch switching can show that color. Primary color uses all 3 shots.
    let totalStock = 0
    let variantCount = 0
    for (const cd of colorData) {
      const variantImages =
        cd.color === primary.color ? [cd.aUrl, cd.bUrl, cd.cUrl] : [cd.aUrl]
      for (const size of p.sizes) {
        const qty = cd.stockBySize[size] ?? 0
        const variantId = `var-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
        await session.run(
          `MATCH (p:Product {id: $productId})
           CREATE (v:ProductVariant {
             id: $variantId, productId: $productId, size: $size, color: $color,
             stockQuantity: $stockQuantity, images: $images
           })-[:VARIANT_OF]->(p)`,
          { productId, variantId, size, color: cd.color, stockQuantity: qty, images: variantImages }
        )
        totalStock += qty
        variantCount++
      }
    }

    console.log(
      `   ✓ ${p.name} [${p.colors.length} color${p.colors.length > 1 ? 's' : ''}, ${variantCount} variants, ${totalStock} stock, 3-shot gallery]`
    )
  }
}

async function main() {
  // Verify all required files are present
  const required = [
    ...heroSlides.flatMap((h) => [h.fileDesktop, h.fileMobile]),
    ...products.flatMap((p) => p.colors.flatMap((c) => [c.fileA, c.fileB, c.fileC])),
  ]
  const missing = required.filter((f) => !fs.existsSync(path.join(IMAGES_DIR, f)))
  if (missing.length > 0) {
    console.error(`❌ Missing ${missing.length} images:`)
    missing.forEach((f) => console.error(`   - ${f}`))
    throw new Error('Generate missing images first.')
  }
  console.log(`📦 Found all ${required.length} required image files`)

  const session = getSession()
  try {
    await clearOld(session)
    await seedHero(session)
    await seedProducts(session)
    const heroCount = (await session.run(`MATCH (h:HeroSlide) RETURN count(h) AS c`)).records[0].get('c')
    const prodCount = (await session.run(`MATCH (p:Product) RETURN count(p) AS c`)).records[0].get('c')
    const varCount = (await session.run(`MATCH (v:ProductVariant) RETURN count(v) AS c`)).records[0].get('c')
    console.log(`\n✅ Done. HeroSlides: ${heroCount}, Products: ${prodCount}, Variants: ${varCount}`)
  } finally {
    await session.close()
    await closeDriver()
  }
}

main().catch((err) => {
  console.error('\n❌ Seed failed:', err)
  process.exit(1)
})
