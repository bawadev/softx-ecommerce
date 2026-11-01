import { getCurrentUser } from '@/lib/auth'
import { getPersonalizedRecommendationsAction, getRecentlyViewedProductsAction } from '@/app/actions/user-profile'
import { getCatalog } from '@/lib/engine'
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
    getCatalog().listNewArrivals(8),
    getAllPromotionalCategoriesAction(true), // Only active categories
    getAllHeroSlidesAction(true), // Only active hero slides
  ])

  // Recommendations / recently-viewed / new arrivals all arrive as engine
  // ProductDTOs now (ProfileService / CatalogService.listNewArrivals). The
  // read used to be a bare repository call that THREW on failure — keep the
  // fail-hard semantics instead of silently rendering an empty section.
  if (!newArrivalsResult.ok) {
    throw new Error(newArrivalsResult.error.message)
  }
  const recommendations = recommendationsResult.data?.products || []
  const recentlyViewed = recentlyViewedResult.data?.products || []
  const newArrivals = newArrivalsResult.data
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
