import { redirect } from 'next/navigation'
import { isAdmin } from '@/lib/auth'
import { getLocale } from 'next-intl/server'
import { getCategoryTreeAction } from '@/app/actions/categories'
import CategoriesClient from './CategoriesClient'

export default async function CategoriesPage() {
  const adminAccess = await isAdmin()
  const locale = await getLocale()

  if (!adminAccess) {
    redirect(`/${locale}/login?redirect=/${locale}/admin/filters`)
  }

  const result = await getCategoryTreeAction()
  const categories = result.data || {}

  return <CategoriesClient initialCategories={categories} />
}
