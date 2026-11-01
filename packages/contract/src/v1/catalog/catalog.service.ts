import type { Result } from '../core/result'
import type { PagedResult } from '../core/paged'
import type { ProductDTO, ListProductsQuery } from './product.dto'
import type { CategoryDTO, CategoryTreeDTO } from './category.dto'
import type { PromotionalCategoryDTO } from './promotional-category.dto'
import type { HeroSlideDTO } from './hero-slide.dto'

export interface CatalogService {
  listProducts(query?: Partial<ListProductsQuery>): Promise<Result<PagedResult<ProductDTO>>>
  listNewArrivals(limit?: number): Promise<Result<ProductDTO[]>>
  getProduct(id: string): Promise<Result<ProductDTO>>
  searchProducts(term: string): Promise<Result<ProductDTO[]>>
  listBrands(): Promise<Result<string[]>>
  listProductsByCategories(categoryIds: string[]): Promise<Result<ProductDTO[]>>
  getCategory(id: string): Promise<Result<CategoryDTO>>
  getCategoryTree(): Promise<Result<CategoryTreeDTO[]>>
  listPromotionalCategories(includeInactive?: boolean): Promise<Result<PromotionalCategoryDTO[]>>
  getPromotionalCategoryBySlug(slug: string): Promise<Result<PromotionalCategoryDTO>>
  listProductsByPromotionalCategory(categoryId: string): Promise<Result<ProductDTO[]>>
  listHeroSlides(activeOnly?: boolean): Promise<Result<HeroSlideDTO[]>>
}
