import { z } from 'zod'

export const HeroAnimationTypeSchema = z.enum(['left-panel', 'top-left-round', 'top-right-panel', 'bottom-right-quarter'])
export const HeroMobileAnimationTypeSchema = z.enum(['bottom-pill', 'bottom-full-panel', 'top-banner', 'center-card'])
export const HeroColorThemeSchema = z.enum(['light', 'dark', 'custom'])

export const CustomPanelStyleSchema = z.object({
  textColor: z.string(),
  panelColor: z.string(),
  panelOpacity: z.number(),
  borderEnabled: z.boolean(),
  borderColor: z.string(),
  borderOpacity: z.number(),
  borderWidth: z.number(),
})
export type CustomPanelStyleDTO = z.infer<typeof CustomPanelStyleSchema>

export const HeroSlideSchema = z.object({
  id: z.string(),
  imageUrl: z.string(),
  mobileImageUrl: z.string().optional(),
  animationType: HeroAnimationTypeSchema,
  mobileAnimationType: HeroMobileAnimationTypeSchema.optional(),
  colorTheme: HeroColorThemeSchema,
  mobileColorTheme: HeroColorThemeSchema.optional(),
  customDesktopStyle: CustomPanelStyleSchema.optional(),
  customMobileStyle: CustomPanelStyleSchema.optional(),
  badgeText: z.string(),
  title: z.string(),
  subtitle: z.string(),
  // Optional Sinhala overrides for the /si storefront — English stays the
  // fallback when absent/empty (LKD-41). Same optional-field idiom as
  // mobileImageUrl.
  badgeTextSi: z.string().optional(),
  titleSi: z.string().optional(),
  subtitleSi: z.string().optional(),
  linkUrl: z.string().optional(),
  displayOrder: z.number().int(),
  isActive: z.boolean(),
})
export type HeroSlideDTO = z.infer<typeof HeroSlideSchema>
