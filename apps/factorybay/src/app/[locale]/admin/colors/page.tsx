import { redirect } from 'next/navigation'
import { getLocale } from 'next-intl/server'
import { getCurrentUser } from '@/lib/auth'
import ColorsClient from './ColorsClient'

export default async function AdminColorsPage() {
  const locale = await getLocale()
  const user = await getCurrentUser()

  if (!user || user.role?.toUpperCase() !== 'ADMIN') {
    redirect(`/${locale}/login?redirect=/${locale}/admin/colors`)
  }

  return <ColorsClient />
}
