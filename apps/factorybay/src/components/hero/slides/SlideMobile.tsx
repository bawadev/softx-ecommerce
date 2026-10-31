'use client'

import Link from 'next/link'
import { motion, useReducedMotion } from 'framer-motion'
import {
  mobilePillVariants,
  mobileBottomPanelVariants,
  mobileTopBannerVariants,
  mobileCenterCardVariants,
  reducedMotionVariants,
  resolveTheme,
} from '../heroAnimationConfig'
import type { HeroMobileAnimationType, HeroColorTheme, CustomPanelStyle } from '@/lib/types'

interface SlideMobileProps {
  title: string
  subtitle: string
  linkUrl?: string
  slideIndex: number
  slideDirection: number
  animationType?: HeroMobileAnimationType
  colorTheme?: HeroColorTheme
  customStyle?: CustomPanelStyle
}

type Shape = 'pill' | 'panel' | 'card'

const LAYOUT_CONFIG: Record<HeroMobileAnimationType, {
  variants: any
  directionAware: boolean
  positionClass: string
  shape: Shape
}> = {
  'bottom-pill': {
    variants: mobilePillVariants,
    directionAware: true,
    positionClass: 'absolute bottom-14 left-[30%] right-3 z-10 rounded-2xl overflow-hidden',
    shape: 'pill',
  },
  'bottom-full-panel': {
    variants: mobileBottomPanelVariants,
    directionAware: false,
    positionClass: 'absolute bottom-0 left-0 right-0 z-10 overflow-hidden',
    shape: 'panel',
  },
  'top-banner': {
    variants: mobileTopBannerVariants,
    directionAware: false,
    positionClass: 'absolute top-4 left-3 right-3 z-10 rounded-xl overflow-hidden',
    shape: 'panel',
  },
  'center-card': {
    variants: mobileCenterCardVariants,
    directionAware: false,
    positionClass:
      'absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[85%] max-w-[340px] z-10 rounded-2xl overflow-hidden',
    shape: 'card',
  },
}

export default function SlideMobile({
  title,
  subtitle,
  linkUrl,
  slideDirection,
  animationType = 'bottom-pill',
  colorTheme = 'dark',
  customStyle,
}: SlideMobileProps) {
  const shouldReduce = useReducedMotion()
  const theme = resolveTheme(colorTheme, customStyle)

  const cfg = LAYOUT_CONFIG[animationType] || LAYOUT_CONFIG['bottom-pill']
  const variants = shouldReduce ? reducedMotionVariants : cfg.variants

  const motionProps: any = cfg.directionAware
    ? { custom: slideDirection, variants, initial: 'initial', animate: 'animate', exit: 'exit' }
    : { variants, initial: 'initial', animate: 'animate', exit: 'exit' }

  const panelStyle = {
    background: `linear-gradient(to top, ${theme.bgGradient})`,
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
    border: theme.border === 'transparent' ? 'none' : `1px solid ${theme.border}`,
  }

  const innerPad = cfg.shape === 'card' ? 'px-5 py-5' : cfg.shape === 'panel' ? 'px-5 py-4' : 'px-4 py-3'
  const titleSize = cfg.shape === 'card' ? 'text-3xl' : 'text-xl'
  const subtitleSize = cfg.shape === 'card' ? 'text-sm' : 'text-[11px]'

  const content = (
    <div className="flex-1 min-w-0">
      <h2
        className={`${titleSize} font-display leading-[0.95] tracking-wide uppercase line-clamp-2 mb-1`}
        style={{ color: theme.text }}
      >
        {title}
      </h2>
      {subtitle && (
        <p
          className={`${subtitleSize} leading-snug line-clamp-3`}
          style={{ color: theme.textMuted }}
        >
          {subtitle}
        </p>
      )}
    </div>
  )

  const body = linkUrl ? (
    <Link href={linkUrl} className={`flex items-center gap-2 ${innerPad}`}>
      {content}
      <svg
        className="w-5 h-5 flex-shrink-0"
        fill="none"
        viewBox="0 0 24 24"
        stroke={theme.textMuted}
        strokeWidth={2}
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
      </svg>
    </Link>
  ) : (
    <div className={innerPad}>{content}</div>
  )

  return (
    <motion.div {...motionProps} className={cfg.positionClass} style={panelStyle}>
      {body}
    </motion.div>
  )
}
