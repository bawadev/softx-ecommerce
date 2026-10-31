import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import CategoriesClient from './CategoriesClient'

export default async function AdminCategoriesPage() {
  const user = await getCurrentUser()

  if (!user || user.role?.toUpperCase() !== 'ADMIN') {
    redirect('/login')
  }

  return <CategoriesClient />
}
