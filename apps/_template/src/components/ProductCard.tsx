import Link from 'next/link'
import type { v1 } from '@softx/contract'
import { formatPrice } from '@/lib/price'

/**
 * The template's own product card — intentionally a from-scratch markup +
 * CSS piece (the "different UI" half of the pilot: same contract, no shared
 * UI code with factorybay beyond the packages themselves).
 */
export default function ProductCard({ product }: { product: v1.ProductDTO }) {
  const image = product.images[0]
  return (
    <Link href={`/product/${product.id}`} className="product-card">
      <div className="product-card-image">
        {image ? (
          <img src={image} alt={product.name} loading="lazy" />
        ) : (
          <div className="product-image-placeholder">no image</div>
        )}
      </div>
      <div className="product-card-body">
        <div className="product-brand">{product.brand}</div>
        <h3 className="product-name">{product.name}</h3>
        <div className="product-price">{formatPrice(product.price.stock)}</div>
      </div>
    </Link>
  )
}
