import Link from 'next/link'
import { getCatalog } from '@/lib/engine'
import ProductCard from '@/components/ProductCard'

// Every page reads live catalog data through the engine — never prerendered
// at build time (there is no DB at build time and data is per-tenant).
export const dynamic = 'force-dynamic'

export default async function HomePage() {
  const catalog = getCatalog()
  const [slidesResult, arrivalsResult] = await Promise.all([
    catalog.listHeroSlides(true),
    catalog.listNewArrivals(8),
  ])

  // Fail hard on engine errors, same semantics as the canonical storefront.
  if (!slidesResult.ok) throw new Error(slidesResult.error.message)
  if (!arrivalsResult.ok) throw new Error(arrivalsResult.error.message)

  const hero = slidesResult.data[0]
  const newArrivals = arrivalsResult.data

  return (
    <>
      <section className="hero" aria-label="Featured">
        {hero ? (
          <>
            {hero.imageUrl ? (
              <img src={hero.imageUrl} alt="" />
            ) : (
              <div className="hero-fallback" />
            )}
            <div className="hero-panel">
              {hero.badgeText ? <span className="hero-badge">{hero.badgeText}</span> : null}
              <h1 className="hero-title">{hero.title}</h1>
              {hero.subtitle ? <p className="hero-subtitle">{hero.subtitle}</p> : null}
              <Link href={hero.linkUrl || '/shop'} className="hero-cta">
                Shop now
              </Link>
            </div>
          </>
        ) : (
          <>
            <div className="hero-fallback" />
            <div className="hero-panel">
              <h1 className="hero-title">New season, same contract.</h1>
              <p className="hero-subtitle">
                A minimal storefront served entirely by the shared engine.
              </p>
              <Link href="/shop" className="hero-cta">
                Shop now
              </Link>
            </div>
          </>
        )}
      </section>

      <section aria-labelledby="new-arrivals">
        <h2 className="section-title" id="new-arrivals">
          New arrivals
        </h2>
        {newArrivals.length > 0 ? (
          <div className="product-grid">
            {newArrivals.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <p>No new arrivals yet — seed this tenant&apos;s catalog.</p>
          </div>
        )}
      </section>
    </>
  )
}
