import { z } from 'zod'
import { MoneySchema } from '../core/money'

export const ProductGenderSchema = z.enum(['MEN', 'WOMEN', 'UNISEX'])
export const SizeOptionSchema = z.enum(['XS', 'S', 'M', 'L', 'XL', 'XXL'])

export const ProductVariantSchema = z.object({
  id: z.string(),
  size: SizeOptionSchema,
  color: z.string(),
  stockQuantity: z.number().int(),
})
export type ProductVariantDTO = z.infer<typeof ProductVariantSchema>

export const ProductSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  brand: z.string(),
  gender: ProductGenderSchema,
  sku: z.string(),
  price: z.object({ stock: MoneySchema, retail: MoneySchema }),
  images: z.array(z.string()),
  createdAt: z.string(),
  updatedAt: z.string(),
  variants: z.array(ProductVariantSchema),
})
export type ProductDTO = z.infer<typeof ProductSchema>

export const ListProductsQuerySchema = z.object({
  brand: z.string().optional(),
  gender: ProductGenderSchema.optional(),
  minPrice: z.number().optional(),
  maxPrice: z.number().optional(),
  search: z.string().optional(),
  limit: z.number().int().positive().max(200).default(50),
  offset: z.number().int().nonnegative().default(0),
})
export type ListProductsQuery = z.infer<typeof ListProductsQuerySchema>
