import { redirect } from 'next/navigation'
import { isAdmin } from '@/lib/auth'
import { getLocale } from 'next-intl/server'
import { getAllPromotionalCategoriesAction } from '@/app/actions/promotional-categories'
import PromotionalCategoriesClient from './PromotionalCategoriesClient'

export default async function PromotionalCategoriesPage() {
  const adminAccess = await isAdmin()
  const locale = await getLocale()

  if (!adminAccess) {
    redirect(`/${locale}/login?redirect=/${locale}/admin/sections`)
  }

  const result = await getAllPromotionalCategoriesAction(false) // Get all categories including inactive
  const categories = result.data || []

  return <PromotionalCategoriesClient initialCategories={categories} />
}
