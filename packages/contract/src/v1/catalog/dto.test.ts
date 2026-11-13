import { describe, it, expect } from 'vitest'
import { ProductSchema } from './product.dto'
import { HeroSlideSchema } from './hero-slide.dto'
import { money } from '../core/money'

const validProduct = {
  id: 'p1',
  name: 'Premium Tee',
  description: 'A tee',
  brand: 'Acme',
  gender: 'UNISEX',
  sku: 'ACME-TEE-1',
  price: { stock: money(249900, 'LKR'), retail: money(299900, 'LKR') },
  images: ['http://localhost:9000/product-images/a.webp'],
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  variants: [
    { id: 'v1', size: 'M', color: 'Black', stockQuantity: 5 },
  ],
}

describe('ProductSchema', () => {
  it('accepts a valid product', () => {
    expect(ProductSchema.safeParse(validProduct).success).toBe(true)
  })

  it('rejects a product with no variants key', () => {
    const { variants, ...noVariants } = validProduct
    expect(ProductSchema.safeParse(noVariants).success).toBe(false)
  })

  it('rejects non-integer money', () => {
    const bad = { ...validProduct, price: { stock: { amountMinor: 1.5, currency: 'LKR' }, retail: money(0, 'LKR') } }
    expect(ProductSchema.safeParse(bad).success).toBe(false)
  })
})

const validHeroSlide = {
  id: 'hero-1',
  imageUrl: 'http://localhost:9000/product-images/hero.webp',
  animationType: 'left-panel',
  colorTheme: 'light',
  badgeText: 'NEW DROP',
  title: 'LOCKED Holiday Collection',
  subtitle: 'Locked in Joy',
  displayOrder: 0,
  isActive: true,
}

describe('HeroSlideSchema', () => {
  it('accepts a slide without Si override fields (English-only legacy data)', () => {
    const parsed = HeroSlideSchema.safeParse(validHeroSlide)
    expect(parsed.success).toBe(true)
  })

  it('accepts a slide with optional Si title/subtitle/badge and round-trips them', () => {
    const parsed = HeroSlideSchema.safeParse({
      ...validHeroSlide,
      titleSi: 'නිවාඩු කාලීන එකතුව',
      subtitleSi: 'සතුට මගෙ සමඟ',
      badgeTextSi: 'අලුත් එකතුවක්',
    })
    expect(parsed.success).toBe(true)
    if (parsed.success) {
      expect(parsed.data.titleSi).toBe('නිවාඩු කාලීන එකතුව')
      expect(parsed.data.subtitleSi).toBe('සතුට මගෙ සමඟ')
      expect(parsed.data.badgeTextSi).toBe('අලුත් එකතුවක්')
    }
  })

  it('rejects a non-string Si field', () => {
    const parsed = HeroSlideSchema.safeParse({ ...validHeroSlide, titleSi: 5 })
    expect(parsed.success).toBe(false)
  })
})
