import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getProductAction } from '@/app/actions/products'
import { shopConfig } from '@/config/shop'
import ProductDetailClient from './ProductDetailClient'

// LKD-50: every page served the same generic layout title; PDPs now carry
// the product name for SEO and share previews.
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string; locale: string }>
}): Promise<Metadata> {
  const { id } = await params
  const { product } = await getProductAction(id)

  if (!product) return {}

  return {
    title: `${product.name} — ${shopConfig.name}`,
    description:
      product.description ||
      `${product.brand} at ${shopConfig.name} — premium brands at stock prices.`,
    openGraph: {
      title: `${product.name} — ${shopConfig.name}`,
      description: product.description || undefined,
      images: product.images?.length ? [product.images[0]] : undefined,
    },
  }
}

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ id: string; locale: string }>
}) {
  const { id } = await params
  const { product } = await getProductAction(id)

  if (!product) {
    notFound()
  }

  return <ProductDetailClient product={product} />
}
