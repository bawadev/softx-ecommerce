import { getCurrentUser } from '@/lib/auth'
import { getPersonalizedRecommendationsAction, getRecentlyViewedProductsAction } from '@/app/actions/user-profile'
import { getNewArrivals, toProductDTO } from '@softx/engine'
import { getAllPromotionalCategoriesAction, getProductsByCategoryAction } from '@/app/actions/promotional-categories'
import { getAllHeroSlidesAction } from '@/app/actions/hero-slides'
import HomePageClient from './HomePageClient'

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  await params // Consume the params promise even though we don't need the locale
  const user = await getCurrentUser()

  // Fetch data in parallel
  const [recommendationsResult, recentlyViewedResult, newArrivalsResult, promoCategoriesResult, heroSlidesResult] = await Promise.all([
    user ? getPersonalizedRecommendationsAction() : Promise.resolve({ success: true, data: { products: [] } }),
    user ? getRecentlyViewedProductsAction() : Promise.resolve({ success: true, data: { products: [] } }),
    getNewArrivals(8),
    getAllPromotionalCategoriesAction(true), // Only active categories
    getAllHeroSlidesAction(true), // Only active hero slides
  ])

  // Recommendations / recently-viewed now arrive as engine ProductDTOs
  // (ProfileService). New arrivals are still a repository read without an
  // engine service yet — adapt them with the engine's shared mapper.
  const recommendations = recommendationsResult.data?.products || []
  const recentlyViewed = recentlyViewedResult.data?.products || []
  const newArrivals = newArrivalsResult.map((p) => toProductDTO(p, process.env.DEFAULT_CURRENCY || 'LKR'))
  const promoCategories = promoCategoriesResult.data || []
  const heroSlides = heroSlidesResult.data || []

  // Fetch products for each promotional category
  const promotionalCategoriesWithProducts = await Promise.all(
    promoCategories.map(async (category) => {
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
