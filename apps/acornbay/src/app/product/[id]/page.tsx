import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getCatalog } from '@/lib/engine'
import { amount } from '@/lib/price'

export const dynamic = 'force-dynamic'

type PageProps = { params: Promise<{ id: string }> }

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params
  const result = await getCatalog().getProduct(id)
  return { title: result.ok ? result.data.name : 'Product not found' }
}

export default async function ProductPage({ params }: PageProps) {
  const { id } = await params
  const result = await getCatalog().getProduct(id)
  if (!result.ok) notFound()

  const product = result.data
  const stock = product.price.stock
  const retail = product.price.retail
  const image = product.images[0]
  const onSale = amount(stock) < amount(retail)

  return (
    <>
      <div className="pdp">
        <div className="pdp-image">
          {image ? (
            <img src={image} alt={product.name} />
          ) : (
            <div className="product-image-placeholder">no image</div>
          )}
        </div>

        <div>
          <div className="pdp-brand">{product.brand}</div>
          <h1 className="pdp-name">{product.name}</h1>

          <div className="pdp-price-row">
            <span className="pdp-price">
              {stock.currency} {amount(stock).toFixed(2)}
            </span>
            {onSale ? (
              <span className="pdp-price-was">
                {retail.currency} {amount(retail).toFixed(2)}
              </span>
            ) : null}
          </div>

          <p className="pdp-description">{product.description}</p>

          <table className="variant-table">
            <caption>Variants</caption>
            <thead>
              <tr>
                <th>Size</th>
                <th>Color</th>
                <th>Stock</th>
              </tr>
            </thead>
            <tbody>
              {product.variants.map((variant) => (
                <tr key={variant.id}>
                  <td>{variant.size}</td>
                  <td>{variant.color}</td>
                  <td>
                    {variant.stockQuantity > 0 ? (
                      <span className="stock-ok">{variant.stockQuantity} available</span>
                    ) : (
                      <span className="stock-out">sold out</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <Link href="/shop" className="pdp-back">
            &larr; Back to shop
          </Link>
        </div>
      </div>
    </>
  )
}
