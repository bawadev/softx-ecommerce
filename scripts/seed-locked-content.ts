/**
 * Seed LOCKED brand content: replaces hero slides + seeds 10 flagship products.
 * Expects generated images at /tmp/locked-images/*.webp
 * Run: npx tsx scripts/seed-locked-content.ts
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

const minioClient = new Minio.Client({
  endPoint: process.env.MINIO_ENDPOINT || 'localhost',
  port: parseInt(process.env.MINIO_PORT || '9000'),
  useSSL: (process.env.MINIO_USE_SSL || 'false') === 'true',
  accessKey: process.env.MINIO_ACCESS_KEY!,
  secretKey: process.env.MINIO_SECRET_KEY!,
})

async function upload(localFile: string, objectName: string): Promise<string> {
  const buf = fs.readFileSync(path.join(IMAGES_DIR, localFile))
  await minioClient.putObject(BUCKET, objectName, buf, buf.length, {
    'Content-Type': 'image/webp',
  })
  return `${MINIO_PUBLIC_URL}/${BUCKET}/${objectName}`
}

const heroSlides = [
  {
    file: 'hero-1-holiday.webp',
    title: 'LOCKED Holiday Collection',
    subtitle: 'Locked in Joy',
    badgeText: 'NEW DROP',
    animationType: 'left-panel',
    colorTheme: 'dark',
    displayOrder: 0,
  },
  {
    file: 'hero-2-elegance.webp',
    title: 'LOCKED Elegance Collection',
    subtitle: 'Locked in Luxury',
    badgeText: 'EDITORIAL',
    animationType: 'bottom-right-quarter',
    colorTheme: 'light',
    displayOrder: 1,
  },
]

interface SeedProduct {
  file: string
  name: string
  description: string
  gender: 'MEN' | 'WOMEN' | 'UNISEX'
  stockPrice: number
  retailPrice: number
  sku: string
  categoryPath: { hierarchy: 'ladies' | 'gents' | 'kids'; leaf: string }
  variants: { size: string; color: string; stockQuantity: number }[]
}

const products: SeedProduct[] = [
  {
    file: 'product-01-tshirt-black.webp',
    name: 'LOCKED Signature Oversized Tee — Jet Black',
    description:
      '240GSM premium cotton heavyweight tee. Bold LOCKED chest print, drop shoulders, relaxed oversized fit. Pre-washed for a lived-in feel.',
    gender: 'UNISEX',
    stockPrice: 3200,
    retailPrice: 4800,
    sku: 'LKD-TEE-BLK-01',
    categoryPath: { hierarchy: 'gents', leaf: 'T-Shirts' },
    variants: [
      { size: 'S', color: 'Black', stockQuantity: 18 },
      { size: 'M', color: 'Black', stockQuantity: 24 },
      { size: 'L', color: 'Black', stockQuantity: 20 },
      { size: 'XL', color: 'Black', stockQuantity: 14 },
    ],
  },
  {
    file: 'product-02-tshirt-white.webp',
    name: 'LOCKED Signature Oversized Tee — Off White',
    description:
      'The essential off-white companion to our jet-black tee. Same 240GSM heavyweight cotton, bold LOCKED chest print, drop shoulder oversized cut.',
    gender: 'UNISEX',
    stockPrice: 3200,
    retailPrice: 4800,
    sku: 'LKD-TEE-WHT-01',
    categoryPath: { hierarchy: 'gents', leaf: 'T-Shirts' },
    variants: [
      { size: 'S', color: 'White', stockQuantity: 15 },
      { size: 'M', color: 'White', stockQuantity: 22 },
      { size: 'L', color: 'White', stockQuantity: 18 },
      { size: 'XL', color: 'White', stockQuantity: 10 },
    ],
  },
  {
    file: 'product-03-hoodie-black.webp',
    name: 'LOCKED Heavyweight Hoodie — Jet Black',
    description:
      '500GSM brushed-back fleece hoodie. Tonal LOCKED chest embroidery, double-lined hood, kangaroo pocket. The warmest piece in the collection.',
    gender: 'UNISEX',
    stockPrice: 6500,
    retailPrice: 9800,
    sku: 'LKD-HDY-BLK-01',
    categoryPath: { hierarchy: 'gents', leaf: 'Hoodies' },
    variants: [
      { size: 'S', color: 'Black', stockQuantity: 10 },
      { size: 'M', color: 'Black', stockQuantity: 16 },
      { size: 'L', color: 'Black', stockQuantity: 14 },
      { size: 'XL', color: 'Black', stockQuantity: 8 },
    ],
  },
  {
    file: 'product-04-hoodie-cream.webp',
    name: 'LOCKED Heavyweight Hoodie — Bone',
    description:
      'Premium 500GSM fleece in soft bone. Dark-thread LOCKED chest embroidery, double-lined hood. Seasonless weight, year-round wearability.',
    gender: 'UNISEX',
    stockPrice: 6500,
    retailPrice: 9800,
    sku: 'LKD-HDY-BON-01',
    categoryPath: { hierarchy: 'gents', leaf: 'Hoodies' },
    variants: [
      { size: 'S', color: 'Bone', stockQuantity: 8 },
      { size: 'M', color: 'Bone', stockQuantity: 14 },
      { size: 'L', color: 'Bone', stockQuantity: 12 },
      { size: 'XL', color: 'Bone', stockQuantity: 6 },
    ],
  },
  {
    file: 'product-05-varsity-jacket.webp',
    name: 'LOCKED Varsity Jacket — Black & Cream',
    description:
      'Wool-blend body with genuine leather sleeves. LOCKED chenille chest patch, ribbed trims, snap-button closure. A statement piece.',
    gender: 'UNISEX',
    stockPrice: 14500,
    retailPrice: 22000,
    sku: 'LKD-VRS-BLK-01',
    categoryPath: { hierarchy: 'gents', leaf: 'Jackets' },
    variants: [
      { size: 'M', color: 'Black/Cream', stockQuantity: 6 },
      { size: 'L', color: 'Black/Cream', stockQuantity: 8 },
      { size: 'XL', color: 'Black/Cream', stockQuantity: 4 },
    ],
  },
  {
    file: 'product-06-cargo-pants.webp',
    name: 'LOCKED Tactical Cargo Pants — Black',
    description:
      'Mid-weight cotton twill cargos. Tapered leg, six-pocket layout, woven LOCKED hip tag. Built for city movement.',
    gender: 'UNISEX',
    stockPrice: 5400,
    retailPrice: 7800,
    sku: 'LKD-CRG-BLK-01',
    categoryPath: { hierarchy: 'gents', leaf: 'Cargo Pants' },
    variants: [
      { size: '30', color: 'Black', stockQuantity: 10 },
      { size: '32', color: 'Black', stockQuantity: 14 },
      { size: '34', color: 'Black', stockQuantity: 12 },
      { size: '36', color: 'Black', stockQuantity: 8 },
    ],
  },
  {
    file: 'product-07-cap-black.webp',
    name: 'LOCKED 6-Panel Cap — Black',
    description:
      'Unstructured 6-panel cap in brushed cotton. Raised LOCKED embroidery on front panel, adjustable strap back.',
    gender: 'UNISEX',
    stockPrice: 1800,
    retailPrice: 2800,
    sku: 'LKD-CAP-BLK-01',
    categoryPath: { hierarchy: 'gents', leaf: 'Hats & Caps' },
    variants: [{ size: 'One Size', color: 'Black', stockQuantity: 30 }],
  },
  {
    file: 'product-08-denim-jacket.webp',
    name: 'LOCKED Oversized Denim Jacket — Washed Indigo',
    description:
      '14oz rigid denim jacket, boxy oversized cut. Large LOCKED back print, chest flap pockets. A future heirloom piece.',
    gender: 'UNISEX',
    stockPrice: 7800,
    retailPrice: 11500,
    sku: 'LKD-DNM-IND-01',
    categoryPath: { hierarchy: 'gents', leaf: 'Denim Jackets' },
    variants: [
      { size: 'M', color: 'Indigo', stockQuantity: 8 },
      { size: 'L', color: 'Indigo', stockQuantity: 10 },
      { size: 'XL', color: 'Indigo', stockQuantity: 6 },
    ],
  },
  {
    file: 'product-09-puffer-jacket.webp',
    name: 'LOCKED Insulated Puffer Jacket — Black',
    description:
      'Down-alternative insulated puffer. Matte-black shell, LOCKED rubber chest patch, storm cuffs, two-way zip.',
    gender: 'UNISEX',
    stockPrice: 11500,
    retailPrice: 17800,
    sku: 'LKD-PUF-BLK-01',
    categoryPath: { hierarchy: 'gents', leaf: 'Jackets' },
    variants: [
      { size: 'M', color: 'Black', stockQuantity: 6 },
      { size: 'L', color: 'Black', stockQuantity: 8 },
      { size: 'XL', color: 'Black', stockQuantity: 5 },
    ],
  },
  {
    file: 'product-10-crewneck-sweat.webp',
    name: 'LOCKED Crewneck Sweater — Charcoal',
    description:
      '450GSM loopback fleece crewneck. Dark-on-dark LOCKED chest embroidery, ribbed trims, relaxed fit.',
    gender: 'UNISEX',
    stockPrice: 4800,
    retailPrice: 7200,
    sku: 'LKD-CRW-CHR-01',
    categoryPath: { hierarchy: 'gents', leaf: 'Sweaters' },
    variants: [
      { size: 'S', color: 'Charcoal', stockQuantity: 10 },
      { size: 'M', color: 'Charcoal', stockQuantity: 16 },
      { size: 'L', color: 'Charcoal', stockQuantity: 14 },
      { size: 'XL', color: 'Charcoal', stockQuantity: 8 },
    ],
  },
]

async function findLeafCategoryId(
  session: any,
  hierarchy: string,
  leafName: string
): Promise<string | null> {
  const res = await session.run(
    `MATCH (c:Category {hierarchy: $hierarchy, name: $name}) RETURN c.id AS id LIMIT 1`,
    { hierarchy, name: leafName }
  )
  return res.records.length ? res.records[0].get('id') : null
}

async function clearOldContent(session: any) {
  console.log('\n🧹 Clearing old demo content...')
  await session.run(`MATCH (h:HeroSlide) DETACH DELETE h`)
  await session.run(
    `MATCH (p:Product) WHERE p.brand IN ['Locked', 'LOCKED'] OPTIONAL MATCH (v:ProductVariant)-[:VARIANT_OF]->(p) DETACH DELETE p, v`
  )
  await session.run(
    `MATCH (v:ProductVariant) WHERE NOT EXISTS { (v)-[:VARIANT_OF]->(:Product) } DETACH DELETE v`
  )
  console.log('   ✓ Removed old HeroSlides, LOCKED-branded Products, and orphan variants')
}

async function seedHero(session: any) {
  console.log('\n🖼️  Seeding hero slides...')
  for (const slide of heroSlides) {
    const url = await upload(slide.file, slide.file)
    const id = `hero-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    const now = new Date().toISOString()
    await session.run(
      `CREATE (h:HeroSlide {
        id: $id, imageUrl: $imageUrl, title: $title, subtitle: $subtitle,
        badgeText: $badgeText, animationType: $animationType, colorTheme: $colorTheme,
        displayOrder: $displayOrder, isActive: true, createdAt: $now, updatedAt: $now
      })`,
      {
        id,
        imageUrl: url,
        title: slide.title,
        subtitle: slide.subtitle,
        badgeText: slide.badgeText,
        animationType: slide.animationType,
        colorTheme: slide.colorTheme,
        displayOrder: slide.displayOrder,
        now,
      }
    )
    console.log(`   ✓ ${slide.title} -> ${slide.file}`)
  }
}

async function seedProducts(session: any) {
  console.log('\n👕 Seeding products...')
  for (const p of products) {
    const imageUrl = await upload(p.file, p.file)
    const productId = `prod-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    const now = new Date().toISOString()

    await session.run(
      `CREATE (p:Product {
        id: $id, name: $name, description: $description, brand: 'LOCKED',
        gender: $gender, stockPrice: $stockPrice, retailPrice: $retailPrice,
        sku: $sku, images: $images, createdAt: $now, updatedAt: $now
      })`,
      {
        id: productId,
        name: p.name,
        description: p.description,
        gender: p.gender,
        stockPrice: p.stockPrice,
        retailPrice: p.retailPrice,
        sku: p.sku,
        images: [imageUrl],
        now,
      }
    )

    // Link to leaf category
    const leafId = await findLeafCategoryId(
      session,
      p.categoryPath.hierarchy,
      p.categoryPath.leaf
    )
    if (leafId) {
      await session.run(
        `MATCH (p:Product {id: $productId}), (c:Category {id: $leafId})
         MERGE (p)-[:HAS_CATEGORY]->(c)`,
        { productId, leafId }
      )
    } else {
      console.log(
        `   ⚠  Category not found: ${p.categoryPath.hierarchy}/${p.categoryPath.leaf}`
      )
    }

    for (const v of p.variants) {
      const variantId = `var-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
      await session.run(
        `MATCH (p:Product {id: $productId})
         CREATE (v:ProductVariant {
           id: $variantId, productId: $productId, size: $size, color: $color,
           stockQuantity: $stockQuantity, images: []
         })-[:VARIANT_OF]->(p)`,
        {
          productId,
          variantId,
          size: v.size,
          color: v.color,
          stockQuantity: v.stockQuantity,
        }
      )
    }

    const totalStock = p.variants.reduce((s, v) => s + v.stockQuantity, 0)
    console.log(
      `   ✓ ${p.name} [${p.variants.length} variants, ${totalStock} in stock]`
    )
  }
}

async function main() {
  const files = fs.readdirSync(IMAGES_DIR).filter((f) => f.endsWith('.webp'))
  console.log(`📦 Found ${files.length} images in ${IMAGES_DIR}`)
  if (files.length < 12) {
    throw new Error(
      `Expected at least 12 images, found ${files.length}. Check image generation output.`
    )
  }

  const session = getSession()
  try {
    await clearOldContent(session)
    await seedHero(session)
    await seedProducts(session)

    const heroCount = (await session.run(`MATCH (h:HeroSlide) RETURN count(h) AS c`)).records[0].get(
      'c'
    )
    const prodCount = (await session.run(`MATCH (p:Product) RETURN count(p) AS c`)).records[0].get(
      'c'
    )
    const varCount = (
      await session.run(`MATCH (v:ProductVariant) RETURN count(v) AS c`)
    ).records[0].get('c')
    console.log(
      `\n✅ Done. HeroSlides: ${heroCount}, Products: ${prodCount}, Variants: ${varCount}`
    )
  } finally {
    await session.close()
    await closeDriver()
  }
}

main().catch((err) => {
  console.error('\n❌ Seed failed:', err)
  process.exit(1)
})
