'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'
import Image from 'next/image'
import { motion, AnimatePresence } from 'framer-motion'
import SearchAutocomplete from '@/components/SearchAutocomplete'
import {
  SLIDE_INTERVAL,
  MOBILE_SLIDE_INTERVAL,
  BG_FADE_DURATION,
  mobileSlideVariants,
  mobilePillVariants,
  reducedMotionVariants,
} from './heroAnimationConfig'
import { useIsMobile } from '@/hooks/useIsMobile'
import type { HeroSlide } from '@/lib/types'
import SlideLeftPanel from './slides/SlideLeftPanel'
import SlideTopLeftRound from './slides/SlideTopLeftRound'
import SlideTopRightPanel from './slides/SlideTopRightPanel'
import SlideBottomSweep from './slides/SlideBottomSweep'
import SlideMobile from './slides/SlideMobile'

const SLIDE_MAP: Record<string, typeof SlideLeftPanel> = {
  'left-panel': SlideLeftPanel,
  'top-left-round': SlideTopLeftRound,
  'top-right-panel': SlideTopRightPanel,
  'bottom-right-quarter': SlideBottomSweep,
}

interface HeroSliderProps {
  slides: HeroSlide[]
}

export default function HeroSlider({ slides }: HeroSliderProps) {
  const [currentSlide, setCurrentSlide] = useState(0)
  const [slideDirection, setSlideDirection] = useState(1) // 1 = push left, -1 = push right
  const [searchOpen, setSearchOpen] = useState(false)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const isMobile = useIsMobile()

  const goToSlide = useCallback((index: number) => {
    setSlideDirection(index % 2 === 0 ? -1 : 1)
    setCurrentSlide(index)
  }, [])

  // Close overlay on Escape key
  useEffect(() => {
    if (!searchOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSearchOpen(false)
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [searchOpen])

  // Auto-focus search input when overlay opens
  useEffect(() => {
    if (searchOpen) {
      setTimeout(() => {
        searchInputRef.current?.focus()
      }, 100)
    }
  }, [searchOpen])

  // Auto-rotate — use shorter interval on mobile
  useEffect(() => {
    if (slides.length === 0) return
    const interval = setInterval(() => {
      setCurrentSlide((prev) => {
        const next = (prev + 1) % slides.length
        // Alternate direction: even slides push left, odd push right
        setSlideDirection(next % 2 === 0 ? -1 : 1)
        return next
      })
    }, isMobile ? MOBILE_SLIDE_INTERVAL : SLIDE_INTERVAL)

    return () => clearInterval(interval)
  }, [currentSlide, slides.length, isMobile]) // reset on manual navigation

  if (slides.length === 0) return null

  const currentSlideData = slides[currentSlide]
  const SlideComponent = SLIDE_MAP[currentSlideData.animationType] || SlideLeftPanel
  const slideProps = {
    title: currentSlideData.title,
    subtitle: currentSlideData.subtitle,
    linkUrl: currentSlideData.linkUrl,
    onSearchClick: () => setSearchOpen(true),
    colorTheme: currentSlideData.colorTheme,
    customStyle: currentSlideData.customDesktopStyle,
  }

  return (
    <div className="relative overflow-hidden bg-black-900 text-white">
      {/* ── Desktop Background: opacity crossfade (all mounted) ── */}
      <div className="absolute inset-0 hidden md:block">
        {slides.map((slide, i) => (
          <motion.div
            key={slide.id}
            className="absolute inset-0"
            animate={{ opacity: i === currentSlide ? 1 : 0 }}
            transition={{ duration: BG_FADE_DURATION, ease: 'easeInOut' }}
          >
            <Image
              src={slide.imageUrl}
              alt={slide.title || `Fashion background ${i + 1}`}
              fill
              className="object-cover"
              priority={i === 0}
              quality={90}
              unoptimized={slide.imageUrl.startsWith('http')}
            />
          </motion.div>
        ))}
        {/* Dark overlay for text readability */}
        <div className="absolute inset-0 bg-black/70" />
      </div>

      {/* ── Mobile Background: sliding images ── */}
      <div className="absolute inset-0 md:hidden">
        <AnimatePresence initial={false} custom={slideDirection}>
          <motion.div
            key={currentSlide}
            custom={slideDirection}
            variants={mobileSlideVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            className="absolute inset-0"
          >
            <Image
              src={currentSlideData.mobileImageUrl || currentSlideData.imageUrl}
              alt={currentSlideData.title || `Fashion background ${currentSlide + 1}`}
              fill
              className="object-cover"
              priority={currentSlide === 0}
              quality={90}
              unoptimized={(currentSlideData.mobileImageUrl || currentSlideData.imageUrl).startsWith('http')}
            />
          </motion.div>
        </AnimatePresence>
        {/* Lighter overlay so image stays more visible on mobile */}
        <div className="absolute inset-0 bg-black/30 pointer-events-none" />
      </div>

      {/* ── Desktop Panels — one at a time ── */}
      <div className="relative min-h-[500px] md:min-h-[600px] lg:min-h-[700px]">
        <div className="hidden md:block h-full">
          <AnimatePresence mode="wait">
            <SlideComponent key={currentSlide} {...slideProps} />
          </AnimatePresence>
        </div>

        {/* ── Floating search icon (mobile only) ── */}
        <button
          onClick={() => setSearchOpen(true)}
          className="absolute top-4 right-4 z-10 md:hidden p-2.5 rounded-full text-white/80 hover:text-white cursor-pointer transition-colors"
          style={{
            background: 'rgba(0,0,0,0.3)',
            backdropFilter: 'blur(10px)',
            WebkitBackdropFilter: 'blur(10px)',
            border: '1px solid rgba(255,255,255,0.2)',
          }}
          aria-label="Search"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </button>

        {/* ── Mobile Pill ── */}
        <div className="md:hidden h-full min-h-[500px]">
          <AnimatePresence initial={false} custom={slideDirection}>
            <SlideMobile
              key={currentSlide}
              title={currentSlideData.title}
              subtitle={currentSlideData.subtitle}
              linkUrl={currentSlideData.linkUrl}
              animationType={currentSlideData.mobileAnimationType || 'bottom-pill'}
              colorTheme={currentSlideData.mobileColorTheme || currentSlideData.colorTheme}
              customStyle={currentSlideData.customMobileStyle || currentSlideData.customDesktopStyle}
              slideIndex={currentSlide}
              slideDirection={slideDirection}
            />
          </AnimatePresence>
        </div>
      </div>

      {/* Full-screen search overlay — portaled to body to escape overflow-hidden */}
      {typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          {searchOpen && (
            <motion.div
              className="fixed inset-0 z-50 flex items-center justify-center"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={(e) => { if (e.target === e.currentTarget) setSearchOpen(false) }}
            >
              {/* Backdrop blur */}
              <div
                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                onClick={() => setSearchOpen(false)}
              />

              {/* Search container */}
              <motion.div
                className="relative z-10 w-full max-w-xl mx-4"
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.25, ease: 'easeOut' }}
                onClick={(e) => e.stopPropagation()}
              >
                {/* Close button */}
                <button
                  onClick={() => setSearchOpen(false)}
                  className="absolute -top-10 right-0 text-white/70 hover:text-white transition-colors text-2xl leading-none"
                  aria-label="Close search"
                >
                  &#x2715;
                </button>

                {/* The actual SearchAutocomplete */}
                <div ref={(el) => {
                  if (el) {
                    const input = el.querySelector('input')
                    if (input) (searchInputRef as React.MutableRefObject<HTMLInputElement | null>).current = input
                  }
                }}>
                  <SearchAutocomplete
                    placeholder="Search products..."
                    large={true}
                    className="!bg-white/20 !backdrop-blur-md !shadow-2xl !border-white/30 [&_input]:!text-white [&_input]:!placeholder-white/70"
                  />
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}

      {/* Dot indicators */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10 flex gap-2">
        {slides.map((_, index) => (
          <button
            key={index}
            onClick={() => goToSlide(index)}
            className={`transition-all duration-300 rounded-full ${
              index === currentSlide
                ? 'w-8 h-2 bg-white'
                : 'w-2 h-2 bg-white/50 hover:bg-white/75'
            }`}
            aria-label={`Go to slide ${index + 1}`}
          />
        ))}
      </div>

      {/* Bottom Wave Separator */}
      <div className="absolute bottom-0 left-0 right-0">
        <svg
          className="w-full h-12 sm:h-16 text-gray-50"
          preserveAspectRatio="none"
          viewBox="0 0 1440 48"
          fill="currentColor"
        >
          <path d="M0,32L80,37.3C160,43,320,53,480,48C640,43,800,21,960,16C1120,11,1280,21,1360,26.7L1440,32L1440,48L1360,48C1280,48,1120,48,960,48C800,48,640,48,480,48C320,48,160,48,80,48L0,48Z" />
        </svg>
      </div>
    </div>
  )
}
