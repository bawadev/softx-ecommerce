import ProductCard from './ProductCard'
import type { v1 } from '@softx/contract'

interface ProductGridProps {
  products: v1.ProductDTO[]
  emptyMessage?: string
}

export default function ProductGrid({
  products,
  emptyMessage = 'No products found',
}: ProductGridProps) {
  if (products.length === 0) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="text-center">
          <p className="text-lg text-gray-600">{emptyMessage}</p>
          <p className="mt-2 text-sm text-gray-500">
            Try adjusting your filters
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 md:gap-5 lg:gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4">
      {products.map((product) => (
        <ProductCard key={product.id} product={product} />
      ))}
    </div>
  )
}
