'use client'

import Link from 'next/link'
import { motion, useReducedMotion } from 'framer-motion'
import type { HeroSlideProps } from '../heroAnimationConfig'
import {
  topRightPanelVariants,
  topRightChildVariants,
  topRightStagger,
  reducedMotionVariants,
  resolveTheme,
} from '../heroAnimationConfig'

export default function SlideTopRightPanel({ title, subtitle, linkUrl, onSearchClick, colorTheme = 'light', customStyle }: HeroSlideProps) {
  const shouldReduce = useReducedMotion()
  const variants = shouldReduce ? reducedMotionVariants : topRightPanelVariants
  const theme = resolveTheme(colorTheme, customStyle)

  return (
    <motion.div
      variants={variants}
      initial="initial"
      animate="animate"
      exit="exit"
      className="absolute inset-y-0 right-0 flex items-center w-[85vw] sm:w-[60vw] md:w-[45vw] lg:w-[38vw]"
    >
      <div
        className="relative h-full w-full flex items-center md:[clip-path:polygon(15%_0,100%_0,100%_100%,0%_100%)]"
        style={{
          background: `linear-gradient(to left, ${theme.bgGradient})`,
          backdropFilter: shouldReduce ? 'blur(8px)' : 'blur(12px)',
          WebkitBackdropFilter: shouldReduce ? 'blur(8px)' : 'blur(12px)',
          border: `1px solid ${theme.border}`,
        }}
      >
        <motion.div
          className="px-6 sm:px-8 md:px-10 lg:px-14 py-8 text-right ml-auto max-w-full"
          variants={shouldReduce ? undefined : { animate: { transition: topRightStagger } }}
          initial="initial"
          animate="animate"
          exit="exit"
        >
          {/* Title */}
          <motion.h1
            variants={shouldReduce ? undefined : topRightChildVariants}
            className="font-display text-5xl sm:text-6xl md:text-7xl lg:text-8xl xl:text-9xl mb-3 sm:mb-4 leading-[0.95] tracking-tight uppercase"
          >
            <span
              className="block drop-shadow-2xl"
              style={{ WebkitBoxDecorationBreak: 'clone', boxDecorationBreak: 'clone', color: theme.text }}
            >
              {title}
            </span>
          </motion.h1>

          {/* Subtitle */}
          <motion.p
            variants={shouldReduce ? undefined : topRightChildVariants}
            className="text-base sm:text-lg md:text-xl drop-shadow-md max-w-md ml-auto leading-relaxed font-light"
            style={{ color: theme.text }}
          >
            {subtitle}
          </motion.p>

          {/* Search trigger */}
          <motion.div variants={shouldReduce ? undefined : topRightChildVariants} className="mt-4 sm:mt-6 flex justify-end">
            <button
              onClick={onSearchClick}
              className="inline-flex items-center gap-2 backdrop-blur-sm border rounded-full px-4 py-2 cursor-pointer transition-colors"
              style={{
                background: theme.buttonBg,
                border: `1px solid ${theme.buttonBorder}`,
                color: theme.textMuted,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = theme.buttonBgHover
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = theme.buttonBg
              }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <span className="text-sm">Search products...</span>
            </button>
          </motion.div>

          {/* See More link */}
          {linkUrl && (
            <motion.div variants={shouldReduce ? undefined : topRightChildVariants} className="mt-2 flex justify-end">
              <Link
                href={linkUrl}
                className="inline-flex items-center gap-1.5 text-sm font-medium transition-colors group"
                style={{
                  color: theme.textLink,
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = theme.text
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = theme.textLink
                }}
              >
                <span>See More</span>
                <svg className="w-4 h-4 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            </motion.div>
          )}
        </motion.div>
      </div>
    </motion.div>
  )
}
