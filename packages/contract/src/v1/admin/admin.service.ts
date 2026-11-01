import { z } from 'zod'
import type { Result } from '../core/result'
import type { ActorRef } from './actor.dto'
import type { ProductDTO } from '../catalog/product.dto'
import {
  ProductGenderSchema,
  SizeOptionSchema,
} from '../catalog/product.dto'
import type { CategoryDTO } from '../catalog/category.dto'
import type { PromotionalCategoryDTO } from '../catalog/promotional-category.dto'
import {
  HeroAnimationTypeSchema,
  HeroMobileAnimationTypeSchema,
  HeroColorThemeSchema,
  CustomPanelStyleSchema,
} from '../catalog/hero-slide.dto'
import type { HeroSlideDTO } from '../catalog/hero-slide.dto'
import type { OrderDTO } from '../order/order.dto'
import { OrderStatusSchema } from '../order/order.dto'

// ---------------------------------------------------------------------------
// Write-input DTOs
//
// These mirror the admin form payloads the app actions actually pass today
// (admin-product-form.ts / HeroSlidesClient / PromotionalCategoriesClient /
// CategoriesClient / ColorsClient). Unlike the storefront read DTOs — where
// prices are Money (minor units) — the write inputs keep stockPrice /
// retailPrice as plain MAJOR-unit numbers: that is the unit the repository
// write boundary (engine Product.stockPrice/retailPrice) and the admin forms
// use. Minor-unit conversion happens inside the engine mappers on read.
// ---------------------------------------------------------------------------

/**
 * Product write payload (admin product form → createProduct/updateProduct).
 * Prices are MAJOR units (e.g. 2999 = Rs. 2,999.00) — the repository
 * boundary's unit; storefront ProductDTO carries Money (minor units).
 */
export const ProductWriteInputSchema = z.object({
  name: z.string().min(1),
  description: z.string(),
  brand: z.string().min(1),
  gender: ProductGenderSchema,
  stockPrice: z.number().positive(),
  retailPrice: z.number().positive(),
  sku: z.string().min(1),
  images: z.array(z.string()),
})
export type ProductWriteInput = z.infer<typeof ProductWriteInputSchema>

/** Create takes the product together with its initial variants (one action, one call). */
export const ProductCreateInputSchema = ProductWriteInputSchema.extend({
  variants: z.array(
    z.object({
      size: SizeOptionSchema,
      color: z.string().min(1),
      stockQuantity: z.number().int().nonnegative(),
    })
  ),
})
export type ProductCreateInput = z.infer<typeof ProductCreateInputSchema>

/** Variant payload as collected by the product form: size/color/stockQuantity. */
export const VariantWriteInputSchema = z.object({
  size: SizeOptionSchema,
  color: z.string().min(1),
  stockQuantity: z.number().int().nonnegative(),
})
export type VariantWriteInput = z.infer<typeof VariantWriteInputSchema>

export const ProductUpdateInputSchema = ProductWriteInputSchema.partial()
export type ProductUpdateInput = z.infer<typeof ProductUpdateInputSchema>

export const VariantUpdateInputSchema = VariantWriteInputSchema.partial()
export type VariantUpdateInput = z.infer<typeof VariantUpdateInputSchema>

/** Category create as the admin UI sends it (slug is generated repo-side). */
export const CategoryCreateInputSchema = z.object({
  name: z.string().min(1),
  hierarchy: z.string().min(1),
  parentId: z.string().nullable().optional(),
  isFeatured: z.boolean().optional(),
})
export type CategoryCreateInput = z.infer<typeof CategoryCreateInputSchema>

/** Category update as the admin UI sends it (name/isActive/isFeatured only). */
export const CategoryUpdateInputSchema = z.object({
  name: z.string().min(1).optional(),
  isActive: z.boolean().optional(),
  isFeatured: z.boolean().optional(),
})
export type CategoryUpdateInput = z.infer<typeof CategoryUpdateInputSchema>

/** Promotional category form payload (slug is user-supplied here). */
export const PromotionalCategoryWriteInputSchema = z.object({
  name: z.string().min(1),
  slug: z.string().min(1),
  description: z.string().optional(),
  displayOrder: z.number().int(),
  isActive: z.boolean().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
})
export type PromotionalCategoryWriteInput = z.infer<
  typeof PromotionalCategoryWriteInputSchema
>

export const PromotionalCategoryUpdateInputSchema =
  PromotionalCategoryWriteInputSchema.partial()
export type PromotionalCategoryUpdateInput = z.infer<
  typeof PromotionalCategoryUpdateInputSchema
>

/**
 * Hero slide create payload — mirrors the create action's argument: every
 * content field plus an explicit displayOrder; isActive defaults engine-side.
 */
export const HeroSlideWriteInputSchema = z.object({
  imageUrl: z.string().min(1),
  mobileImageUrl: z.string().optional(),
  animationType: HeroAnimationTypeSchema,
  mobileAnimationType: HeroMobileAnimationTypeSchema.optional(),
  colorTheme: HeroColorThemeSchema.optional(),
  mobileColorTheme: HeroColorThemeSchema.optional(),
  customDesktopStyle: CustomPanelStyleSchema.optional(),
  customMobileStyle: CustomPanelStyleSchema.optional(),
  badgeText: z.string(),
  title: z.string(),
  subtitle: z.string(),
  linkUrl: z.string().optional(),
  displayOrder: z.number().int(),
  isActive: z.boolean().optional(),
})
export type HeroSlideWriteInput = z.infer<typeof HeroSlideWriteInputSchema>

export const HeroSlideUpdateInputSchema = HeroSlideWriteInputSchema.partial()
export type HeroSlideUpdateInput = z.infer<typeof HeroSlideUpdateInputSchema>

/** Color row as returned by the color repository ({id, name, hex, isActive, createdAt}). */
export const ColorDTOSchema = z.object({
  id: z.string(),
  name: z.string(),
  hex: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  isActive: z.boolean(),
  createdAt: z.string(),
})
export type ColorDTO = z.infer<typeof ColorDTOSchema>

export const ColorSeedInputSchema = z.object({
  name: z.string().min(1),
  hex: z.string().regex(/^#[0-9a-fA-F]{6}$/),
})
export type ColorSeedInput = z.infer<typeof ColorSeedInputSchema>

// ---------------------------------------------------------------------------
// Admin service interfaces
//
// Every method takes `actor` FIRST and enforces `actor.kind === 'admin'`
// engine-side, returning UNAUTHORIZED ('Admin access required') otherwise.
// ---------------------------------------------------------------------------

export interface AdminCatalogService {
  // Products
  createProduct(actor: ActorRef, input: ProductCreateInput): Promise<Result<ProductDTO>>
  updateProduct(actor: ActorRef, id: string, input: ProductUpdateInput): Promise<Result<ProductDTO>>
  deleteProduct(actor: ActorRef, id: string): Promise<Result<null>>
  addVariant(actor: ActorRef, productId: string, input: VariantWriteInput): Promise<Result<ProductDTO>>
  updateVariant(actor: ActorRef, variantId: string, input: VariantUpdateInput): Promise<Result<ProductDTO>>
  addProductImage(actor: ActorRef, productId: string, imageUrl: string): Promise<Result<ProductDTO>>
  removeProductImage(actor: ActorRef, productId: string, imageUrl: string): Promise<Result<ProductDTO>>
  searchProductsByName(actor: ActorRef, term: string): Promise<Result<ProductDTO[]>>
  checkProductNameExists(actor: ActorRef, name: string, excludeId?: string): Promise<Result<boolean>>

  // Categories
  createCategory(actor: ActorRef, input: CategoryCreateInput): Promise<Result<CategoryDTO>>
  updateCategory(actor: ActorRef, id: string, input: CategoryUpdateInput): Promise<Result<CategoryDTO>>
  deleteCategory(actor: ActorRef, id: string): Promise<Result<null>>
  moveCategory(actor: ActorRef, id: string, newParentId: string | null): Promise<Result<CategoryDTO>>
  assignProductToCategory(actor: ActorRef, productId: string, categoryId: string): Promise<Result<null>>
  assignProductToCategories(actor: ActorRef, productId: string, categoryIds: string[]): Promise<Result<null>>
  removeProductFromCategory(actor: ActorRef, productId: string, categoryId: string): Promise<Result<null>>

  // Promotional categories
  createPromotionalCategory(actor: ActorRef, input: PromotionalCategoryWriteInput): Promise<Result<PromotionalCategoryDTO>>
  updatePromotionalCategory(actor: ActorRef, id: string, input: PromotionalCategoryUpdateInput): Promise<Result<PromotionalCategoryDTO>>
  deletePromotionalCategory(actor: ActorRef, id: string): Promise<Result<null>>
  addProductToPromotionalCategory(actor: ActorRef, categoryId: string, productId: string, allocatedQuantity: number): Promise<Result<null>>
  removeProductFromPromotionalCategory(actor: ActorRef, categoryId: string, productId: string): Promise<Result<null>>
  setPromotionalCategoryQuantity(actor: ActorRef, categoryId: string, productId: string, allocatedQuantity: number): Promise<Result<null>>
  toggleProductInPromotionalCategory(actor: ActorRef, categoryId: string, productId: string, isActive: boolean): Promise<Result<null>>
  moveQuantity(actor: ActorRef, productId: string, fromCategoryId: string, toCategoryId: string, quantity: number): Promise<Result<null>>

  // Hero slides
  createHeroSlide(actor: ActorRef, input: HeroSlideWriteInput): Promise<Result<HeroSlideDTO>>
  updateHeroSlide(actor: ActorRef, id: string, input: HeroSlideUpdateInput): Promise<Result<HeroSlideDTO>>
  deleteHeroSlide(actor: ActorRef, id: string): Promise<Result<null>>
  reorderHeroSlides(actor: ActorRef, slides: Array<{ id: string; displayOrder: number }>): Promise<Result<null>>

  // Colors
  listColors(actor: ActorRef): Promise<Result<ColorDTO[]>>
  createColor(actor: ActorRef, name: string, hex: string): Promise<Result<ColorDTO>>
  toggleColorActive(actor: ActorRef, id: string): Promise<Result<ColorDTO>>
  deleteColor(actor: ActorRef, id: string): Promise<Result<null>>
  colorCount(actor: ActorRef): Promise<Result<number>>
  seedColors(actor: ActorRef, colors: ColorSeedInput[]): Promise<Result<number>>
}

export interface AdminOrderService {
  listAllOrders(actor: ActorRef): Promise<Result<OrderDTO[]>>
  updateOrderStatus(actor: ActorRef, orderId: string, status: z.infer<typeof OrderStatusSchema>): Promise<Result<null>>
}
