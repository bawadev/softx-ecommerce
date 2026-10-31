import { redirect } from 'next/navigation'
import { isAdmin } from '@/lib/auth'
import { getLocale } from 'next-intl/server'
import { getAllHeroSlidesAction } from '@/app/actions/hero-slides'
import { getAllPromotionalCategoriesAction } from '@/app/actions/promotional-categories'
import HeroSlidesClient from './HeroSlidesClient'

export default async function HeroSlidesPage() {
  const adminAccess = await isAdmin()
  const locale = await getLocale()

  if (!adminAccess) {
    redirect(`/${locale}/login?redirect=/${locale}/admin/hero-slides`)
  }

  const result = await getAllHeroSlidesAction(false) // Include inactive
  const slides = result.data || []

  const promoResult = await getAllPromotionalCategoriesAction(true) // Active only
  const promotionalCategories = promoResult.data || []

  return <HeroSlidesClient initialSlides={slides} promotionalCategories={promotionalCategories} />
}
