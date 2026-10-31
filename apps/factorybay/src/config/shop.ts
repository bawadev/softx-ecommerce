export const shopConfig = {
  // Primary branding
  name: process.env.NEXT_PUBLIC_SHOP_NAME || 'LOCKED',
  tagline: process.env.NEXT_PUBLIC_SHOP_TAGLINE || 'LOCKED in with Life',

  // Alternative taglines for different contexts
  taglines: {
    short: process.env.NEXT_PUBLIC_SHOP_TAGLINE || 'LOCKED in with Life',
    premium: process.env.NEXT_PUBLIC_SHOP_TAGLINE_PREMIUM || 'Premium Brands for Your Lifestyle',
    discovery: process.env.NEXT_PUBLIC_SHOP_TAGLINE_DISCOVERY || 'Discover premium fashion that locks in your style',
  },

  // Legal/Business
  companyName: process.env.NEXT_PUBLIC_COMPANY_NAME || 'LOCKED (Pvt) Ltd',

  // URLs
  url: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',

  // Contact
  supportEmail: process.env.NEXT_PUBLIC_SUPPORT_EMAIL || 'support@locked.com',

  // Social media (optional)
  social: {
    facebook: process.env.NEXT_PUBLIC_FACEBOOK_URL || '',
    instagram: process.env.NEXT_PUBLIC_INSTAGRAM_URL || '',
    twitter: process.env.NEXT_PUBLIC_TWITTER_URL || '',
  },
} as const

// Type exports for TypeScript
export type ShopConfig = typeof shopConfig
