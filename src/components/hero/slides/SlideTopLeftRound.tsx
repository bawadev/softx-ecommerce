'use client'

import Link from 'next/link'
import { motion, useReducedMotion } from 'framer-motion'
import type { HeroSlideProps } from '../heroAnimationConfig'
import {
  topLeftRoundVariants,
  topLeftRoundChildVariants,
  topLeftRoundStagger,
  reducedMotionVariants,
  resolveTheme,
} from '../heroAnimationConfig'

export default function SlideTopLeftRound({ title, subtitle, linkUrl, onSearchClick, colorTheme = 'light', customStyle }: HeroSlideProps) {
  const shouldReduce = useReducedMotion()
  const variants = shouldReduce ? reducedMotionVariants : topLeftRoundVariants
  const theme = resolveTheme(colorTheme, customStyle)

  return (
    <motion.div
      variants={variants}
      initial="initial"
      animate="animate"
      exit="exit"
      className="absolute top-4 sm:top-8 md:top-12 left-4 sm:left-8 md:left-12 flex items-center justify-center
        w-[85vw] h-[70vw] rounded-3xl
        sm:w-[55vw] sm:h-[55vw]
        md:w-[40vw] md:h-[40vw] md:rounded-full md:max-w-[500px] md:max-h-[500px]
        [container-type:inline-size]"
      style={{
        background: `radial-gradient(circle, ${theme.bgGradientRadial})`,
        backdropFilter: shouldReduce ? 'blur(8px)' : 'blur(16px)',
        WebkitBackdropFilter: shouldReduce ? 'blur(8px)' : 'blur(16px)',
        border: `1px solid ${theme.border}`,
      }}
    >
      <motion.div
        className="px-6 sm:px-8 md:px-10 py-6 text-center max-w-[90%]"
        variants={shouldReduce ? undefined : { animate: { transition: topLeftRoundStagger } }}
        initial="initial"
        animate="animate"
        exit="exit"
      >
        {/* Title */}
        <motion.h1
          variants={shouldReduce ? undefined : topLeftRoundChildVariants}
          className="font-display text-[clamp(2rem,11cqi,4.5rem)] mb-3 leading-[0.9] tracking-[-0.02em] uppercase break-words [text-wrap:balance] hyphens-manual"
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
          variants={shouldReduce ? undefined : topLeftRoundChildVariants}
          className="text-sm sm:text-base md:text-lg drop-shadow-md leading-relaxed font-light"
          style={{ color: theme.text }}
        >
          {subtitle}
        </motion.p>

        {/* Search trigger */}
        <motion.div variants={shouldReduce ? undefined : topLeftRoundChildVariants} className="mt-3 sm:mt-4">
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
          <motion.div variants={shouldReduce ? undefined : topLeftRoundChildVariants} className="mt-2">
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
    </motion.div>
  )
}
