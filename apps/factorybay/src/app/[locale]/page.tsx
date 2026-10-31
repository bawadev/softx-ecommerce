import { getCurrentUser } from '@/lib/auth'
import { getPersonalizedRecommendationsAction, getRecentlyViewedProductsAction } from '@/app/actions/user-profile'
import { getNewArrivals } from '@/lib/repositories/recommendation.repository'
import { getAllPromotionalCategoriesAction, getProductsByCategoryAction } from '@/app/actions/promotional-categories'
import { getAllHeroSlidesAction } from '@/app/actions/hero-slides'
import type { PromotionalCategory } from '@/lib/types'
import HomePageClient from './HomePageClient'

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  await params // Consume the params promise even though we don't need the locale
  const user = await getCurrentUser()

  // Fetch data in parallel
  const [recommendationsResult, recentlyViewedResult, newArrivals, promoCategoriesResult, heroSlidesResult] = await Promise.all([
    user ? getPersonalizedRecommendationsAction() : Promise.resolve({ success: true, data: { products: [] } }),
    user ? getRecentlyViewedProductsAction() : Promise.resolve({ success: true, data: { products: [] } }),
    getNewArrivals(8),
    getAllPromotionalCategoriesAction(true), // Only active categories
    getAllHeroSlidesAction(true), // Only active hero slides
  ])

  const recommendations = recommendationsResult.data?.products || []
  const recentlyViewed = recentlyViewedResult.data?.products || []
  const promoCategories = promoCategoriesResult.data || []
  const heroSlides = heroSlidesResult.data || []

  // Fetch products for each promotional category
  const promotionalCategoriesWithProducts = await Promise.all(
    promoCategories.map(async (category: PromotionalCategory) => {
      const productsResult = await getProductsByCategoryAction(category.id, 8)
      return {
        category,
        products: productsResult.data || [],
      }
    })
  )

  return (
    <HomePageClient
      isAuthenticated={!!user}
      recommendations={recommendations}
      recentlyViewed={recentlyViewed}
      newArrivals={newArrivals}
      promotionalCategories={promotionalCategoriesWithProducts}
      heroSlides={heroSlides}
    />
  )
}
