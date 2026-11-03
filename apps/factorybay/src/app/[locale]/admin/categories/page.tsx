import { redirect } from 'next/navigation'
import { getLocale } from 'next-intl/server'
import { getCurrentUser } from '@/lib/auth'
import CategoriesClient from './CategoriesClient'

export default async function AdminCategoriesPage() {
  const locale = await getLocale()
  const user = await getCurrentUser()

  if (!user || user.role?.toUpperCase() !== 'ADMIN') {
    redirect(`/${locale}/login?redirect=/${locale}/admin/categories`)
  }

  return <CategoriesClient />
}
