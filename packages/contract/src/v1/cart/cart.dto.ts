import { z } from 'zod'
import { MoneySchema } from '../core/money'
import { SizeOptionSchema } from '../catalog/product.dto'

export const GuestCartLineSchema = z.object({
  variantId: z.string(),
  quantity: z.number().int().positive(),
})
export type GuestCartLine = z.infer<typeof GuestCartLineSchema>

export const CartOwnerSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('user'), userId: z.string() }),
  z.object({ kind: z.literal('guest'), items: z.array(GuestCartLineSchema) }),
])
export type CartOwner = z.infer<typeof CartOwnerSchema>

export const ProductSummarySchema = z.object({
  id: z.string(),
  name: z.string(),
  brand: z.string(),
  sku: z.string(),
  images: z.array(z.string()),
  price: z.object({ stock: MoneySchema, retail: MoneySchema }),
})
export type ProductSummaryDTO = z.infer<typeof ProductSummarySchema>

export const VariantSummarySchema = z.object({
  id: z.string(),
  size: SizeOptionSchema,
  color: z.string(),
  stockQuantity: z.number().int(),
})
export type VariantSummaryDTO = z.infer<typeof VariantSummarySchema>

export const CartItemSchema = z.object({
  variantId: z.string(),
  quantity: z.number().int().positive(),
  product: ProductSummarySchema,
  variant: VariantSummarySchema,
})
export type CartItemDTO = z.infer<typeof CartItemSchema>

export const CartDTOSchema = z.object({
  items: z.array(CartItemSchema),
  itemCount: z.number().int(),
  total: MoneySchema,
})
export type CartDTO = z.infer<typeof CartDTOSchema>

export const CartMutationSchema = z.object({
  cart: CartDTOSchema,
  guestItems: z.array(GuestCartLineSchema).optional(),
})
export type CartMutation = z.infer<typeof CartMutationSchema>
