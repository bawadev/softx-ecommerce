import { redirect } from 'next/navigation'
import { getLocale } from 'next-intl/server'
import { isAdmin } from '@/lib/auth'
import { getAdminProductsAction } from '@/app/actions/admin-products'
import InventoryDashboardClient from './InventoryDashboardClient'

export default async function InventoryPage() {
  const locale = await getLocale()
  const adminAccess = await isAdmin()

  if (!adminAccess) {
    redirect(`/${locale}/login?redirect=/${locale}/admin/inventory`)
  }

  const result = await getAdminProductsAction()

  if (!result.success || !result.data) {
    return <div>Failed to load inventory data</div>
  }

  return <InventoryDashboardClient products={result.data.products} />
}
