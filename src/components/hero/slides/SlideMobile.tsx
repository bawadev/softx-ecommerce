'use client'

import Link from 'next/link'
import { motion, useReducedMotion } from 'framer-motion'
import {
  mobilePillVariants,
  reducedMotionVariants,
} from '../heroAnimationConfig'

interface SlideMobileProps {
  title: string
  subtitle: string
  linkUrl?: string
  slideIndex: number
  slideDirection: number
}

export default function SlideMobile({ title, subtitle, linkUrl, slideDirection }: SlideMobileProps) {
  const shouldReduce = useReducedMotion()

  const textBlock = (
    <div className="flex-1 min-w-0">
      <h2 className="text-base font-bold text-white leading-tight line-clamp-2 mb-0.5">
        {title}
      </h2>
      {subtitle && (
        <p className="text-[11px] text-white leading-snug line-clamp-2">
          {subtitle}
        </p>
      )}
    </div>
  )

  return (
    <motion.div
      custom={slideDirection}
      variants={shouldReduce ? reducedMotionVariants : mobilePillVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      className="absolute bottom-14 left-[30%] right-3 z-10 rounded-2xl overflow-hidden"
      style={{
        background: 'rgba(0,0,0,0.35)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        border: '1px solid rgba(255,255,255,0.15)',
      }}
    >
      {linkUrl ? (
        <Link href={linkUrl} className="flex items-center gap-2 px-4 py-3">
          {textBlock}
          <svg className="w-5 h-5 flex-shrink-0 text-white/70" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </Link>
      ) : (
        <div className="px-4 py-3">
          {textBlock}
        </div>
      )}
    </motion.div>
  )
}
