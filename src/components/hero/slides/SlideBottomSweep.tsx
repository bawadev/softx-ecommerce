'use client'

import Link from 'next/link'
import { motion, useReducedMotion } from 'framer-motion'
import type { HeroSlideProps } from '../heroAnimationConfig'
import {
  bottomSweepVariants,
  bottomSweepChildVariants,
  bottomSweepStagger,
  reducedMotionVariants,
  resolveTheme,
} from '../heroAnimationConfig'

export default function SlideBottomSweep({ title, subtitle, linkUrl, onSearchClick, colorTheme = 'light', customStyle }: HeroSlideProps) {
  const shouldReduce = useReducedMotion()
  const variants = shouldReduce ? reducedMotionVariants : bottomSweepVariants
  const theme = resolveTheme(colorTheme, customStyle)

  return (
    <motion.div
      variants={variants}
      initial="initial"
      animate="animate"
      exit="exit"
      className="absolute bottom-0 right-0 flex items-end justify-end
        w-[85vw] h-[70vw] rounded-tl-full
        sm:w-[60vw] sm:h-[60vw]
        md:w-[45vw] md:h-[45vw] md:max-w-[550px] md:max-h-[550px]"
      style={{
        background: `radial-gradient(circle at bottom right, ${theme.bgGradientRadial})`,
        backdropFilter: shouldReduce ? 'blur(8px)' : 'blur(16px)',
        WebkitBackdropFilter: shouldReduce ? 'blur(8px)' : 'blur(16px)',
        border: `1px solid ${theme.border}`,
        borderRight: 'none',
        borderBottom: 'none',
        transformOrigin: 'bottom right',
      }}
    >
      <motion.div
        className="px-6 sm:px-8 md:px-10 py-6 text-right max-w-[75%] mr-6 sm:mr-10 md:mr-12 mb-16 sm:mb-20 md:mb-24"
        variants={shouldReduce ? undefined : { animate: { transition: bottomSweepStagger } }}
        initial="initial"
        animate="animate"
        exit="exit"
      >
        {/* Title */}
        <motion.h1
          variants={shouldReduce ? undefined : bottomSweepChildVariants}
          className="font-display text-4xl sm:text-5xl md:text-6xl lg:text-7xl mb-2 sm:mb-3 leading-[0.95] tracking-wide uppercase"
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
          variants={shouldReduce ? undefined : bottomSweepChildVariants}
          className="text-sm sm:text-base md:text-lg drop-shadow-md leading-relaxed font-light"
          style={{ color: theme.text }}
        >
          {subtitle}
        </motion.p>

        {/* Search trigger */}
        <motion.div variants={shouldReduce ? undefined : bottomSweepChildVariants} className="mt-3 sm:mt-4 flex justify-end">
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
          <motion.div variants={shouldReduce ? undefined : bottomSweepChildVariants} className="mt-2 flex justify-end">
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
