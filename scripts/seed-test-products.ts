/**
 * Seed test products for development/testing
 * Run with: npx tsx scripts/seed-test-products.ts
 */

import dotenv from 'dotenv'
import * as fs from 'fs'
import * as path from 'path'
import * as Minio from 'minio'
import { getSession, closeDriver } from '../src/lib/db'

dotenv.config({ path: '.env.local' })

const minioClient = new Minio.Client({
  endPoint: process.env.MINIO_ENDPOINT || 'localhost',
  port: parseInt(process.env.MINIO_PORT || '9000'),
  useSSL: false,
  accessKey: process.env.MINIO_ACCESS_KEY || 'ecommerce',
  secretKey: process.env.MINIO_SECRET_KEY || 'ecommerce123',
})

const bucketName = process.env.MINIO_BUCKET_NAME || 'product-images'
const minioUrl = process.env.NEXT_PUBLIC_MINIO_URL || 'http://localhost:9000'

async function uploadImage(filePath: string): Promise<string> {
  const fileName = `${Date.now()}-${path.basename(filePath)}`
  const fileBuffer = fs.readFileSync(filePath)
  const contentType = filePath.endsWith('.webp') ? 'image/webp' : 'image/jpeg'

  await minioClient.putObject(bucketName, fileName, fileBuffer, fileBuffer.length, {
    'Content-Type': contentType,
  })

  return `${minioUrl}/${bucketName}/${fileName}`
}

const testProducts = [
  {
    name: 'Classic Cotton T-Shirt',
    description: 'Premium quality cotton t-shirt, comfortable and durable.',
    brand: 'UrbanStyle',
    gender: 'MEN',
    stockPrice: 850,
    retailPrice: 1500,
    sku: 'UST-001',
    category: 'SHIRT',
    imageFile: 'lc1.jpg',
    variants: [
      { size: 'S', color: 'White', stockQuantity: 25 },
      { size: 'M', color: 'White', stockQuantity: 30 },
      { size: 'L', color: 'White', stockQuantity: 20 },
      { size: 'XL', color: 'White', stockQuantity: 15 },
    ],
  },
  {
    name: 'Slim Fit Chinos',
    description: 'Modern slim-fit chinos for everyday wear.',
    brand: 'DenimCo',
    gender: 'MEN',
    stockPrice: 1200,
    retailPrice: 2200,
    sku: 'DC-002',
    category: 'PANTS',
    imageFile: 'lc2.webp',
    variants: [
      { size: 'S', color: 'Khaki', stockQuantity: 20 },
      { size: 'M', color: 'Khaki', stockQuantity: 35 },
      { size: 'L', color: 'Khaki', stockQuantity: 25 },
    ],
  },
  {
    name: 'Floral Summer Dress',
    description: 'Elegant floral dress perfect for summer outings.',
    brand: 'BloomWear',
    gender: 'WOMEN',
    stockPrice: 1500,
    retailPrice: 2800,
    sku: 'BW-003',
    category: 'DRESS',
    imageFile: 'lc3.webp',
    variants: [
      { size: 'XS', color: 'Blue Floral', stockQuantity: 15 },
      { size: 'S', color: 'Blue Floral', stockQuantity: 20 },
      { size: 'M', color: 'Blue Floral', stockQuantity: 25 },
      { size: 'L', color: 'Blue Floral', stockQuantity: 10 },
    ],
  },
  {
    name: 'Leather Biker Jacket',
    description: 'Classic leather jacket with modern styling.',
    brand: 'EdgeWear',
    gender: 'UNISEX',
    stockPrice: 3500,
    retailPrice: 6500,
    sku: 'EW-004',
    category: 'JACKET',
    imageFile: 'lc4.webp',
    variants: [
      { size: 'M', color: 'Black', stockQuantity: 10 },
      { size: 'L', color: 'Black', stockQuantity: 12 },
      { size: 'XL', color: 'Black', stockQuantity: 8 },
    ],
  },
]

async function seedProducts() {
  console.log('Seeding test products...\n')

  const imagesDir = path.join(__dirname, '..', 'public', 'images', 'products')
  const session = getSession()

  try {
    for (const product of testProducts) {
      // Check if product already exists
      const existing = await session.run(
        'MATCH (p:Product {sku: $sku}) RETURN p',
        { sku: product.sku }
      )

      if (existing.records.length > 0) {
        console.log(`  Skipped: ${product.name} (already exists)`)
        continue
      }

      // Upload image to MinIO
      const imagePath = path.join(imagesDir, product.imageFile)
      let imageUrl = ''
      if (fs.existsSync(imagePath)) {
        imageUrl = await uploadImage(imagePath)
        console.log(`  Uploaded image: ${product.imageFile}`)
      } else {
        console.log(`  Warning: Image not found: ${imagePath}`)
      }

      // Create product + variants in a single transaction
      const productId = `prod-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
      const now = new Date().toISOString()

      await session.run(
        `
        CREATE (p:Product {
          id: $id,
          name: $name,
          description: $description,
          brand: $brand,
          gender: $gender,
          stockPrice: $stockPrice,
          retailPrice: $retailPrice,
          sku: $sku,
          category: $category,
          images: $images,
          createdAt: $now,
          updatedAt: $now
        })
        `,
        {
          id: productId,
          name: product.name,
          description: product.description,
          brand: product.brand,
          gender: product.gender,
          stockPrice: product.stockPrice,
          retailPrice: product.retailPrice,
          sku: product.sku,
          category: product.category,
          images: imageUrl ? [imageUrl] : [],
          now,
        }
      )

      // Create variants
      for (const variant of product.variants) {
        const variantId = `var-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
        await session.run(
          `
          MATCH (p:Product {id: $productId})
          CREATE (v:ProductVariant {
            id: $variantId,
            productId: $productId,
            size: $size,
            color: $color,
            stockQuantity: $stockQuantity,
            images: []
          })-[:VARIANT_OF]->(p)
          `,
          {
            productId,
            variantId,
            size: variant.size,
            color: variant.color,
            stockQuantity: variant.stockQuantity,
          }
        )
      }

      const totalStock = product.variants.reduce((sum, v) => sum + v.stockQuantity, 0)
      console.log(`  Created: ${product.name} (${product.variants.length} variants, ${totalStock} total stock)`)
    }

    console.log('\nDone! Products seeded successfully.')
    console.log('Login at http://localhost:3000/en/admin/sections to test promotional sections.')
  } catch (error) {
    console.error('Error seeding products:', error)
  } finally {
    await session.close()
    await closeDriver()
  }
}

seedProducts()
