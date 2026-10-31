import { v1 } from '@softx/contract'
import type { ProductWithVariants } from '../repositories/product.repository'
import type { Category } from '../repositories/category.repository'
import type { PromotionalCategory, HeroSlide } from '../types'

export function toProductDTO(p: ProductWithVariants, currency: string): v1.ProductDTO {
  return {
    id: p.id,
    name: p.name,
    description: p.description,
    brand: p.brand,
    gender: p.gender,
    sku: p.sku,
    price: { stock: v1.fromMajorAmount(p.stockPrice, currency), retail: v1.fromMajorAmount(p.retailPrice, currency) },
    images: p.images,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
    variants: p.variants.map((v) => ({
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
    ...(s.linkUrl ? { linkUrl: s.linkUrl } : {}),
    displayOrder: s.displayOrder, isActive: s.isActive,
  }
}
