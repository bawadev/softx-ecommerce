import { notFound } from 'next/navigation'
import { getProductAction } from '@/app/actions/products'
import ProductDetailClient from './ProductDetailClient'

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
