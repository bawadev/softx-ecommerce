import { z } from 'zod'
import { MoneySchema } from '../core/money'

export const OrderStatusSchema = z.enum(['PENDING', 'CONFIRMED', 'FULFILLED', 'CANCELLED'])
export const DeliveryMethodSchema = z.enum(['SHIP', 'COLLECT'])

export const ShippingAddressSchema = z.object({
  fullName: z.string().min(1),
  addressLine1: z.string().min(1),
  addressLine2: z.string().optional(),
  city: z.string().min(1),
  state: z.string().min(1),
  postalCode: z.string().min(1),
  country: z.string().min(1),
  phone: z.string().min(1),
})
export type ShippingAddressDTO = z.infer<typeof ShippingAddressSchema>

export const OrderItemSchema = z.object({
  variantId: z.string(),
  quantity: z.number().int().positive(),
  priceAtPurchase: MoneySchema,
  productName: z.string(),
  productImage: z.string().optional(),
})
export type OrderItemDTO = z.infer<typeof OrderItemSchema>

export const OrderSchema = z.object({
  id: z.string(),
  orderNumber: z.string(),
  status: OrderStatusSchema,
  totalAmount: MoneySchema,
  shippingAddress: ShippingAddressSchema,
  deliveryMethod: DeliveryMethodSchema,
  paymentProof: z.string().optional(),
  items: z.array(OrderItemSchema),
  createdAt: z.string(),
  updatedAt: z.string(),
})
export type OrderDTO = z.infer<typeof OrderSchema>

export const CreateOrderCommandSchema = z.object({
  shippingAddress: ShippingAddressSchema,
  deliveryMethod: DeliveryMethodSchema,
  email: z.string().email().optional(),
})
export type CreateOrderCommand = z.infer<typeof CreateOrderCommandSchema>
