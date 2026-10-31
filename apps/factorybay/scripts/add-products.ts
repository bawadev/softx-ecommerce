import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

import { createProduct } from '../src/lib/repositories/product.repository'
import { assignProductToCategories } from '../src/lib/repositories/category.repository'
import { uploadFile } from '../src/lib/minio'
import { getSession, closeDriver } from '../src/lib/db'
import fs from 'fs'
import path from 'path'

const GENTS_TSHIRTS_CATEGORY_ID = '4b66ac95-60a7-416d-8fe8-1f7d8bd27397'

const products = [
  {
    name: 'Lanka Black Oversized T-Shirt',
    description: 'Premium black oversized t-shirt featuring bold LANKA text print across the chest. Relaxed fit with dropped shoulders for a streetwear-inspired look. Made from high-quality cotton for all-day comfort.',
    brand: 'Lanka',
    gender: 'MEN' as const,
    stockPrice: 1200,
    retailPrice: 2500,
    sku: 'LNK-BLK-OS-001',
    imageFile: 'lc1.jpg',
    variants: [
      { size: 'M' as const, color: 'Black', stockQuantity: 50, images: [] },
      { size: 'L' as const, color: 'Black', stockQuantity: 40, images: [] },
      { size: 'XL' as const, color: 'Black', stockQuantity: 30, images: [] },
    ],
  },
  {
    name: 'AYBL Charcoal Oversized T-Shirt',
    description: 'Dark charcoal oversized t-shirt with subtle AYBL branding on chest. Premium cotton blend with a relaxed, boxy silhouette. Perfect for casual everyday wear or gym sessions.',
    brand: 'AYBL',
    gender: 'MEN' as const,
    stockPrice: 1400,
    retailPrice: 2800,
    sku: 'AYBL-CHR-OS-001',
    imageFile: 'lc2.webp',
    variants: [
      { size: 'M' as const, color: 'Charcoal', stockQuantity: 45, images: [] },
      { size: 'L' as const, color: 'Charcoal', stockQuantity: 35, images: [] },
      { size: 'XL' as const, color: 'Charcoal', stockQuantity: 25, images: [] },
    ],
  },
  {
    name: 'White Ribbed Oversized T-Shirt',
    description: 'Clean white oversized t-shirt with a subtle ribbed texture. Minimalist design with a crew neck and relaxed fit. Breathable cotton fabric ideal for warm weather and layering.',
    brand: 'Lanka',
    gender: 'MEN' as const,
    stockPrice: 1100,
    retailPrice: 2300,
    sku: 'LNK-WHT-RB-001',
    imageFile: 'lc3.webp',
    variants: [
      { size: 'S' as const, color: 'White', stockQuantity: 30, images: [] },
      { size: 'M' as const, color: 'White', stockQuantity: 50, images: [] },
      { size: 'L' as const, color: 'White', stockQuantity: 40, images: [] },
      { size: 'XL' as const, color: 'White', stockQuantity: 20, images: [] },
    ],
  },
  {
    name: 'AYBL Grey Oversized T-Shirt',
    description: 'Light grey oversized t-shirt with tonal AYBL branding. Premium soft-touch cotton with a contemporary boxy fit. Versatile staple piece for casual and athleisure styling.',
    brand: 'AYBL',
    gender: 'MEN' as const,
    stockPrice: 1400,
    retailPrice: 2800,
    sku: 'AYBL-GRY-OS-001',
    imageFile: 'lc4.webp',
    variants: [
      { size: 'M' as const, color: 'Grey', stockQuantity: 40, images: [] },
      { size: 'L' as const, color: 'Grey', stockQuantity: 35, images: [] },
      { size: 'XL' as const, color: 'Grey', stockQuantity: 30, images: [] },
      { size: 'XXL' as const, color: 'Grey', stockQuantity: 15, images: [] },
    ],
  },
]

async function main() {
  console.log('🚀 Adding products to Ecom...\n')

  for (const productData of products) {
    try {
      // Upload image to MinIO
      const imagePath = path.join(__dirname, '..', 'public', 'images', 'products', productData.imageFile)
      const imageBuffer = fs.readFileSync(imagePath)
      const contentType = productData.imageFile.endsWith('.webp') ? 'image/webp' : 'image/jpeg'

      console.log(`📸 Uploading image: ${productData.imageFile}...`)
      const imageUrl = await uploadFile(imageBuffer, productData.imageFile, contentType)
      console.log(`   ✅ Image uploaded: ${imageUrl}`)

      // Create product
      console.log(`📦 Creating product: ${productData.name}...`)
      const product = await createProduct(
        {
          name: productData.name,
          description: productData.description,
          brand: productData.brand,
          gender: productData.gender,
          stockPrice: productData.stockPrice,
          retailPrice: productData.retailPrice,
          sku: productData.sku,
          images: [imageUrl],
          category: undefined as any,
        },
        productData.variants
      )
      console.log(`   ✅ Product created with ID: ${product.id}`)

      // Assign to category
      console.log(`   🏷️  Assigning to Gents > Tops > T-Shirts category...`)
      const session = getSession()
      await assignProductToCategories(session, product.id, [GENTS_TSHIRTS_CATEGORY_ID])
      await session.close()
      console.log(`   ✅ Category assigned`)

      console.log(`   📊 Variants: ${productData.variants.map(v => `${v.size}/${v.color}(${v.stockQuantity})`).join(', ')}`)
      console.log('')
    } catch (error) {
      console.error(`❌ Error adding ${productData.name}:`, error)
    }
  }

  console.log('✨ All products added successfully!')
  await closeDriver()
  process.exit(0)
}

main()
