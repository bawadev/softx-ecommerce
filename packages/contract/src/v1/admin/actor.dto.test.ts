import { describe, it, expect } from 'vitest'
import { ActorRefSchema } from './actor.dto'
import {
  ProductWriteInputSchema,
  ColorDTOSchema,
  HeroSlideWriteInputSchema,
  HeroSlideUpdateInputSchema,
} from './admin.service'

describe('ActorRefSchema', () => {
  it('parses the three actor kinds and rejects unknown kinds', () => {
    expect(ActorRefSchema.safeParse({ kind: 'anonymous' }).success).toBe(true)
    expect(ActorRefSchema.safeParse({ kind: 'customer', userId: 'u1' }).success).toBe(true)
    expect(ActorRefSchema.safeParse({ kind: 'admin', userId: 'u2' }).success).toBe(true)
    expect(ActorRefSchema.safeParse({ kind: 'guest' }).success).toBe(false)
    expect(ActorRefSchema.safeParse({ kind: 'customer' }).success).toBe(false)
  })
})

describe('ProductWriteInputSchema', () => {
  it('accepts the form payload and rejects non-positive prices (MAJOR units)', () => {
    const base = {
      name: 'Premium Tee',
      description: 'A tee',
      brand: 'Acme',
      gender: 'UNISEX',
      stockPrice: 2499,
      retailPrice: 2999,
      sku: 'ACME-TEE-1',
      images: [] as string[],
    }
    expect(ProductWriteInputSchema.safeParse(base).success).toBe(true)
    expect(ProductWriteInputSchema.safeParse({ ...base, stockPrice: -1 }).success).toBe(false)
    expect(ProductWriteInputSchema.safeParse({ ...base, retailPrice: 0 }).success).toBe(false)
  })
})

describe('ColorDTOSchema', () => {
  it('matches the color repository row shape', () => {
    expect(
      ColorDTOSchema.safeParse({
        id: 'c1',
        name: 'black',
        hex: '#000000',
        isActive: true,
        createdAt: '2026-01-01T00:00:00.000Z',
      }).success
    ).toBe(true)
    expect(
      ColorDTOSchema.safeParse({ id: 'c1', name: 'black', hex: '#000000' }).success
    ).toBe(false)
    expect(
      ColorDTOSchema.safeParse({
        id: 'c1',
        name: 'black',
        hex: '000000',
        isActive: true,
        createdAt: '2026-01-01T00:00:00.000Z',
      }).success
    ).toBe(false)
  })
})

describe('HeroSlideWriteInputSchema', () => {
  it('accepts the minimal create payload and requires displayOrder', () => {
    const minimal = {
      imageUrl: 'http://localhost:9000/product-images/hero.webp',
      animationType: 'left-panel',
      badgeText: 'New',
      title: 'Winter drop',
      subtitle: 'Coats for the cold',
      displayOrder: 1,
    }
    expect(HeroSlideWriteInputSchema.safeParse(minimal).success).toBe(true)
    const { displayOrder, ...withoutOrder } = minimal
    expect(HeroSlideWriteInputSchema.safeParse(withoutOrder).success).toBe(false)
    // Update input: clearable fields accept null (the UI clears with null);
    // non-clearable fields reject it.
    expect(
      HeroSlideUpdateInputSchema.safeParse({
        title: 'Winter drop',
        mobileImageUrl: null,
        mobileAnimationType: null,
        mobileColorTheme: null,
        customDesktopStyle: null,
        customMobileStyle: null,
        linkUrl: null,
      }).success
    ).toBe(true)
    expect(HeroSlideUpdateInputSchema.safeParse({ title: null }).success).toBe(false)
    expect(HeroSlideUpdateInputSchema.safeParse({ animationType: null }).success).toBe(false)
  })
})
