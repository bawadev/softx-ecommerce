import { getCatalog } from '@/lib/engine'
import ProductCard from '@/components/ProductCard'

export const dynamic = 'force-dynamic'

export const metadata = { title: 'Shop' }

export default async function ShopPage() {
  const result = await getCatalog().listProducts()
  if (!result.ok) throw new Error(result.error.message)

  const { items, total } = result.data

  return (
    <>
      <h1 className="page-title">Shop</h1>
      <p className="page-sub">
        {total} {total === 1 ? 'product' : 'products'} in this store
      </p>
      {items.length > 0 ? (
        <div className="product-grid">
          {items.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <p>This store&apos;s catalog is empty — seed this tenant to populate it.</p>
        </div>
      )}
    </>
  )
}
