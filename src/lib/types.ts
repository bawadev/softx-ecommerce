// Action response type
export interface ActionResponse<T = void> {
  success: boolean
  message?: string
  data?: T
}

// User types
export type UserRole = 'CUSTOMER' | 'ADMIN'

export interface User {
  id: string
  email: string
  role: UserRole
  firstName: string
  lastName: string
  phone?: string
  createdAt: string
  updatedAt: string
}

export interface CreateUserInput {
  email: string
  password: string
  firstName: string
  lastName: string
  phone?: string
  role?: UserRole
}

// Auth types
export interface LoginInput {
  email: string
  password: string
}

export interface AuthResponse {
  success: boolean
  message?: string
  user?: User
}

export interface JWTPayload {
  userId: string
  email: string
  role: UserRole
}

// Product types
export type ProductCategory = 'SHIRT' | 'PANTS' | 'JACKET' | 'DRESS' | 'SHOES' | 'ACCESSORIES'
export type ProductGender = 'MEN' | 'WOMEN' | 'UNISEX'
export type SizeOption = 'XS' | 'S' | 'M' | 'L' | 'XL' | 'XXL'

export interface Product {
  id: string
  name: string
  description: string
  brand: string
  category?: ProductCategory // DEPRECATED: Use filters (TAGGED_WITH relationship) instead
  gender: ProductGender
  stockPrice: number
  retailPrice: number
  sku: string
  images: string[] // Product-level images (shared across all variants)
  createdAt: string
  updatedAt: string
}

export interface ProductVariant {
  id: string
  productId: string
  size: SizeOption
  color: string
  stockQuantity: number
  images: string[] // DEPRECATED: Use Product.images instead. Kept for backwards compatibility.
}

// Order types
export type OrderStatus = 'PENDING' | 'CONFIRMED' | 'FULFILLED' | 'CANCELLED'
export type DeliveryMethod = 'SHIP' | 'COLLECT'

export interface Order {
  id: string
  orderNumber: string
  userId: string
  status: OrderStatus
  totalAmount: number
  shippingAddress: ShippingAddress
  deliveryMethod: DeliveryMethod
  paymentProof?: string
  createdAt: string
  updatedAt: string
}

export interface ShippingAddress {
  fullName: string
  addressLine1: string
  addressLine2?: string
  city: string
  state: string
  postalCode: string
  country: string
  phone: string
}

export interface OrderItem {
  id: string
  orderId: string
  variantId: string
  quantity: number
  priceAtPurchase: number
}

// Cart types
export interface CartItem {
  id: string
  userId: string
  variantId: string
  quantity: number
  addedAt: string
}

// User preferences and measurements
export interface UserPreference {
  id: string
  userId: string
  preferredBrands: string[]
  preferredColors: string[]
  preferredCategories: ProductCategory[]
  priceRange: {
    min: number
    max: number
  }
}

export type MeasurementUnit = 'METRIC' | 'IMPERIAL'

export interface UserMeasurements {
  id: string
  userId: string
  chest?: number
  waist?: number
  hips?: number
  shoulders?: number
  inseam?: number
  height?: number
  weight?: number
  preferredSize?: SizeOption
  unit: MeasurementUnit
}

// Browsing history
export interface ProductView {
  id: string
  userId: string
  productId: string
  viewedAt: string
}

// Hero slides
export type HeroAnimationType = 'left-panel' | 'top-left-round' | 'top-right-panel' | 'bottom-right-quarter'
export type HeroColorTheme = 'light' | 'dark'

export interface HeroSlide {
  id: string
  imageUrl: string
  animationType: HeroAnimationType
  colorTheme: HeroColorTheme
  badgeText: string
  title: string
  subtitle: string
  linkUrl?: string
  displayOrder: number
  isActive: boolean
  createdAt: string
  updatedAt: string
}

// Promotional categories
export interface PromotionalCategory {
  id: string
  name: string
  slug: string
  description?: string
  displayOrder: number
  isActive: boolean
  startDate?: string
  endDate?: string
  createdAt: string
  updatedAt: string
}

export interface PromotionalCategoryItem {
  id: string
  categoryId: string
  productId: string
  allocatedQuantity: number
  soldQuantity: number
  isActive: boolean
  addedAt: string
}
