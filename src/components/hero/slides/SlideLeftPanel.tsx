'use client'

import Link from 'next/link'
import { motion, useReducedMotion } from 'framer-motion'
import type { HeroSlideProps } from '../heroAnimationConfig'
import {
  leftPanelVariants,
  leftPanelChildVariants,
  leftPanelStagger,
  reducedMotionVariants,
  resolveTheme,
} from '../heroAnimationConfig'

export default function SlideLeftPanel({ title, subtitle, linkUrl, onSearchClick, colorTheme = 'light', customStyle }: HeroSlideProps) {
  const shouldReduce = useReducedMotion()
  const variants = shouldReduce ? reducedMotionVariants : leftPanelVariants
  const theme = resolveTheme(colorTheme, customStyle)

  return (
    <motion.div
      variants={variants}
      initial="initial"
      animate="animate"
      exit="exit"
      className="absolute inset-y-0 left-0 flex items-center w-[85vw] sm:w-[60vw] md:w-[45vw] lg:w-[35vw]"
    >
      <div
        className="relative h-full w-full flex items-center"
        style={{
          background: `linear-gradient(to right, ${theme.bgGradient})`,
          backdropFilter: shouldReduce ? 'blur(8px)' : 'blur(12px)',
          WebkitBackdropFilter: shouldReduce ? 'blur(8px)' : 'blur(12px)',
          border: `1px solid ${theme.border}`,
        }}
      >
        <motion.div
          className="px-6 sm:px-8 md:px-10 lg:px-12 py-8 text-left max-w-full"
          variants={shouldReduce ? undefined : { animate: { transition: leftPanelStagger } }}
          initial="initial"
          animate="animate"
          exit="exit"
        >
          {/* Title */}
          <motion.h1
            variants={shouldReduce ? undefined : leftPanelChildVariants}
            className="font-display text-[clamp(2.25rem,5.5vw,5rem)] mb-3 sm:mb-4 leading-[0.95] tracking-wide uppercase break-words"
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
            variants={shouldReduce ? undefined : leftPanelChildVariants}
            className="text-base sm:text-lg md:text-xl drop-shadow-md max-w-md leading-relaxed font-light"
            style={{ color: theme.text }}
          >
            {subtitle}
          </motion.p>

          {/* Search trigger */}
          <motion.div variants={shouldReduce ? undefined : leftPanelChildVariants} className="mt-4 sm:mt-6">
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
            <motion.div variants={shouldReduce ? undefined : leftPanelChildVariants} className="mt-2">
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
