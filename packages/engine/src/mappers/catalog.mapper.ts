import { v1 } from '@softx/contract'
import type { ProductWithVariants } from '../repositories/product.repository'
import type { Category } from '../repositories/category.repository'
import type { Color } from '../repositories/color.repository'
import type { PromotionalCategory, HeroSlide } from '../types'
import { convertNeo4jIntegers } from '../neo4j-utils'

export function toProductDTO(p: ProductWithVariants, currency: string): v1.ProductDTO {
  // The product repository returns raw Neo4j records (record.get('p')), so
  // integer properties — variant stockQuantity today — arrive as Neo4j
  // Integer objects, which fail the contract's z.number().int() validation.
  // Normalize the whole record defensively before mapping.
  const src = convertNeo4jIntegers(p)
  return {
    id: src.id,
    name: src.name,
    description: src.description,
    brand: src.brand,
    gender: src.gender,
    sku: src.sku,
    price: { stock: v1.fromMajorAmount(src.stockPrice, currency), retail: v1.fromMajorAmount(src.retailPrice, currency) },
    // Products with the images property dropped by Neo4j (null properties
    // vanish) can surface `images: undefined` — the DTO field is a required
    // array, so materialize the empty list.
    images: src.images ?? [],
    createdAt: src.createdAt,
    updatedAt: src.updatedAt,
    variants: src.variants.map((v) => ({
      id: v.id, size: v.size, color: v.color, stockQuantity: v.stockQuantity,
    })),
  }
}

export function toCategoryDTO(c: Category): v1.CategoryDTO {
  return {
    id: c.id, name: c.name, slug: c.slug, hierarchy: c.hierarchy,
    parentId: c.parentId ?? null, level: c.level, isActive: c.isActive,
    isFeatured: c.isFeatured,
    ...(c.productCount !== undefined ? { productCount: c.productCount } : {}),
    createdAt: c.createdAt, updatedAt: c.updatedAt,
  }
}

export function toPromotionalCategoryDTO(pc: PromotionalCategory): v1.PromotionalCategoryDTO {
  return {
    id: pc.id, name: pc.name, slug: pc.slug,
    ...(pc.description ? { description: pc.description } : {}),
    displayOrder: pc.displayOrder, isActive: pc.isActive,
    ...(pc.startDate ? { startDate: pc.startDate } : {}),
    ...(pc.endDate ? { endDate: pc.endDate } : {}),
    createdAt: pc.createdAt, updatedAt: pc.updatedAt,
  }
}

/**
 * Map a color.repository row onto `v1.ColorDTO` (admin colors surface).
 * Field-explicit like the other mappers: the repository already projects
 * `{id, name, hex, isActive, createdAt}` (with `coalesce(c.isActive, true)`),
 * so this is a shape pin, not a conversion.
 */
export function toColorDTO(c: Color): v1.ColorDTO {
  return {
    id: c.id,
    name: c.name,
    hex: c.hex,
    isActive: c.isActive,
    createdAt: c.createdAt,
  }
}

export function toHeroSlideDTO(s: HeroSlide): v1.HeroSlideDTO {
  return {
    id: s.id,
    imageUrl: s.imageUrl,
    ...(s.mobileImageUrl ? { mobileImageUrl: s.mobileImageUrl } : {}),
    animationType: s.animationType,
    ...(s.mobileAnimationType ? { mobileAnimationType: s.mobileAnimationType } : {}),
    colorTheme: s.colorTheme,
    ...(s.mobileColorTheme ? { mobileColorTheme: s.mobileColorTheme } : {}),
    ...(s.customDesktopStyle ? { customDesktopStyle: s.customDesktopStyle } : {}),
    ...(s.customMobileStyle ? { customMobileStyle: s.customMobileStyle } : {}),
    badgeText: s.badgeText, title: s.title, subtitle: s.subtitle,
    ...(s.badgeTextSi ? { badgeTextSi: s.badgeTextSi } : {}),
    ...(s.titleSi ? { titleSi: s.titleSi } : {}),
    ...(s.subtitleSi ? { subtitleSi: s.subtitleSi } : {}),
    ...(s.linkUrl ? { linkUrl: s.linkUrl } : {}),
    displayOrder: s.displayOrder, isActive: s.isActive,
  }
}
