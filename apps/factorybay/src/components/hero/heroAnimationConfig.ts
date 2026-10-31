import type { Variants, Transition } from 'framer-motion'
import type { CustomPanelStyle, HeroColorTheme } from '@/lib/types'

export interface ResolvedTheme {
  bgGradient: string
  bgGradientRadial: string
  border: string
  borderHover: string
  buttonBg: string
  buttonBgHover: string
  buttonBorder: string
  text: string
  textMuted: string
  textLink: string
}

// ── Props interface shared by all slide components ──
export interface HeroSlideProps {
  title: string
  subtitle: string
  linkUrl?: string
  onSearchClick: () => void
  colorTheme?: HeroColorTheme
  customStyle?: CustomPanelStyle
}

// ── Color theme configurations ──
export const colorThemes: Record<'light' | 'dark', ResolvedTheme> = {
  light: {
    bgGradient: 'rgba(255,255,255,0.15) 0%, rgba(255,255,255,0.06) 60%, transparent 100%',
    bgGradientRadial: 'rgba(255,255,255,0.18) 0%, rgba(255,255,255,0.06) 60%, transparent 100%',
    border: 'rgba(255,255,255,0.15)',
    borderHover: 'rgba(255,255,255,0.25)',
    buttonBg: 'rgba(255,255,255,0.10)',
    buttonBgHover: 'rgba(255,255,255,0.20)',
    buttonBorder: 'rgba(255,255,255,0.20)',
    text: 'white',
    textMuted: 'rgba(255,255,255,0.70)',
    textLink: 'rgba(255,255,255,0.80)',
  },
  dark: {
    bgGradient: 'rgba(0,0,0,0.50) 0%, rgba(0,0,0,0.35) 60%, transparent 100%',
    bgGradientRadial: 'rgba(0,0,0,0.60) 0%, rgba(0,0,0,0.40) 60%, transparent 100%',
    border: 'rgba(0,0,0,0.50)',
    borderHover: 'rgba(0,0,0,0.70)',
    buttonBg: 'rgba(0,0,0,0.30)',
    buttonBgHover: 'rgba(0,0,0,0.50)',
    buttonBorder: 'rgba(255,255,255,0.15)',
    text: 'white',
    textMuted: 'rgba(255,255,255,0.70)',
    textLink: 'rgba(255,255,255,0.80)',
  },
}

/** Parse hex (#rrggbb or #rgb) into {r,g,b}. Falls back to black. */
function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const h = (hex || '').trim().replace('#', '')
  if (h.length === 3) {
    return { r: parseInt(h[0] + h[0], 16), g: parseInt(h[1] + h[1], 16), b: parseInt(h[2] + h[2], 16) }
  }
  if (h.length === 6) {
    return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16) }
  }
  return { r: 0, g: 0, b: 0 }
}

function rgba(hex: string, alpha: number): string {
  const { r, g, b } = hexToRgb(hex)
  const a = Math.max(0, Math.min(1, alpha))
  return `rgba(${r},${g},${b},${a})`
}

/** Convert a CustomPanelStyle into the same ResolvedTheme shape slide components expect. */
function customThemeFromStyle(style: CustomPanelStyle): ResolvedTheme {
  const panelAlpha = Math.max(0, Math.min(1, style.panelOpacity / 100))
  const borderAlpha = Math.max(0, Math.min(1, style.borderOpacity / 100))
  const panelAt = (mult: number) => rgba(style.panelColor, panelAlpha * mult)
  const borderRgba = style.borderEnabled ? rgba(style.borderColor, borderAlpha) : 'transparent'

  return {
    bgGradient: `${panelAt(1)} 0%, ${panelAt(0.75)} 60%, transparent 100%`,
    bgGradientRadial: `${panelAt(1.1)} 0%, ${panelAt(0.8)} 60%, transparent 100%`,
    border: borderRgba,
    borderHover: style.borderEnabled ? rgba(style.borderColor, Math.min(1, borderAlpha * 1.5)) : 'transparent',
    buttonBg: panelAt(0.7),
    buttonBgHover: panelAt(1.1),
    buttonBorder: borderRgba,
    text: style.textColor,
    textMuted: rgba(style.textColor, 0.7),
    textLink: rgba(style.textColor, 0.85),
  }
}

/** Pick the right resolved theme for a slide context. */
export function resolveTheme(colorTheme: HeroColorTheme | undefined, customStyle: CustomPanelStyle | undefined): ResolvedTheme {
  if (colorTheme === 'custom' && customStyle) return customThemeFromStyle(customStyle)
  if (colorTheme === 'dark') return colorThemes.dark
  return colorThemes.light
}

// ── Timing constants ──
export const SLIDE_INTERVAL = 6000 // ms per full cycle
export const MOBILE_SLIDE_INTERVAL = 4000 // ms per mobile cycle
export const BG_FADE_DURATION = 1.2 // seconds

// ── Reduced-motion fallback variant ──
export const reducedMotionVariants: Variants = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { duration: 0.3 } },
  exit: { opacity: 0, transition: { duration: 0.3 } },
}

// ── Slide 1: Left Panel ──
export const leftPanelVariants: Variants = {
  initial: { x: '-100%' },
  animate: {
    x: 0,
    transition: { type: 'spring', stiffness: 80, damping: 18 },
  },
  exit: {
    x: '-120%',
    rotate: -3,
    transition: { duration: 0.6, ease: 'easeIn' },
  },
}

export const leftPanelChildVariants: Variants = {
  initial: { opacity: 0, x: -30 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -20, transition: { duration: 0.3 } },
}

export const leftPanelStagger: Transition = {
  staggerChildren: 0.15,
  delayChildren: 0.2,
}

// ── Slide 2: Top-Left Round ──
export const topLeftRoundVariants: Variants = {
  initial: { scale: 0.2, x: '-50%', y: '-50%', opacity: 0 },
  animate: {
    scale: 1,
    x: 0,
    y: 0,
    opacity: 1,
    transition: { type: 'spring', stiffness: 70, damping: 15 },
  },
  exit: {
    scale: 0.1,
    x: '-60%',
    y: '-60%',
    rotate: -15,
    opacity: 0,
    transition: { duration: 0.6, ease: 'easeIn' },
  },
}

export const topLeftRoundChildVariants: Variants = {
  initial: { opacity: 0, scale: 0.8 },
  animate: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.8, transition: { duration: 0.3 } },
}

export const topLeftRoundStagger: Transition = {
  staggerChildren: 0.12,
  delayChildren: 0.3,
}

// ── Slide 3: Top-Right Panel ──
export const topRightPanelVariants: Variants = {
  initial: { x: '100%', skewX: 5 },
  animate: {
    x: 0,
    skewX: 0,
    transition: { type: 'spring', stiffness: 80, damping: 18 },
  },
  exit: {
    x: '120%',
    skewX: -8,
    scale: 0.95,
    transition: { duration: 0.5, ease: [0.76, 0, 0.24, 1] }, // easeInQuint
  },
}

export const topRightChildVariants: Variants = {
  initial: { opacity: 0, x: 30 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: 20, transition: { duration: 0.3 } },
}

export const topRightStagger: Transition = {
  staggerChildren: 0.15,
  delayChildren: 0.2,
}

// ── Slide 4: Bottom-Right Quarter Circle ──
export const bottomSweepVariants: Variants = {
  initial: { scale: 0.2, x: '50%', y: '50%', opacity: 0 },
  animate: {
    scale: 1,
    x: 0,
    y: 0,
    opacity: 1,
    transition: { type: 'spring', stiffness: 70, damping: 15 },
  },
  exit: {
    scale: 0.1,
    x: '60%',
    y: '60%',
    rotate: 15,
    opacity: 0,
    transition: { duration: 0.6, ease: 'easeIn' },
  },
}

export const bottomSweepChildVariants: Variants = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: 10, transition: { duration: 0.3 } },
}

export const bottomSweepStagger: Transition = {
  staggerChildren: 0.12,
  delayChildren: 0.2,
}

// ── Mobile: Sliding image variants (direction-aware via custom prop) ──
// custom = 1 means "entering from right, exiting to left" (push left)
// custom = -1 means "entering from left, exiting to right" (push right)
export const mobileSlideVariants: Variants = {
  initial: (direction: number) => ({
    x: direction > 0 ? '100%' : '-100%',
    opacity: 0,
  }),
  animate: {
    x: 0,
    opacity: 1,
    transition: { duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] },
  },
  exit: (direction: number) => ({
    x: direction > 0 ? '-100%' : '100%',
    opacity: 0,
    transition: { duration: 0.4, ease: 'easeIn' },
  }),
}

// ── Mobile: Pill panel variants (direction-aware via custom prop) ──
export const mobilePillVariants: Variants = {
  initial: (direction: number) => ({
    x: direction > 0 ? '100%' : '-100%',
    opacity: 0,
  }),
  animate: {
    x: 0,
    opacity: 1,
    transition: { type: 'spring', stiffness: 120, damping: 20 },
  },
  exit: (direction: number) => ({
    x: direction > 0 ? '-100%' : '100%',
    opacity: 0,
    transition: { duration: 0.3, ease: 'easeIn' },
  }),
}

// ── Mobile: Full-width bottom panel (slides up from below) ──
export const mobileBottomPanelVariants: Variants = {
  initial: { y: '100%', opacity: 0 },
  animate: {
    y: 0,
    opacity: 1,
    transition: { type: 'spring', stiffness: 90, damping: 18 },
  },
  exit: {
    y: '100%',
    opacity: 0,
    transition: { duration: 0.35, ease: 'easeIn' },
  },
}

// ── Mobile: Top banner (slides down from top) ──
export const mobileTopBannerVariants: Variants = {
  initial: { y: '-100%', opacity: 0 },
  animate: {
    y: 0,
    opacity: 1,
    transition: { type: 'spring', stiffness: 100, damping: 18 },
  },
  exit: {
    y: '-100%',
    opacity: 0,
    transition: { duration: 0.35, ease: 'easeIn' },
  },
}

// ── Mobile: Center card (scale-in) ──
export const mobileCenterCardVariants: Variants = {
  initial: { scale: 0.8, opacity: 0 },
  animate: {
    scale: 1,
    opacity: 1,
    transition: { type: 'spring', stiffness: 140, damping: 18 },
  },
  exit: {
    scale: 0.9,
    opacity: 0,
    transition: { duration: 0.3, ease: 'easeIn' },
  },
}
