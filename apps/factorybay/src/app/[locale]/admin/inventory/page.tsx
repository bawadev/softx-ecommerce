import { redirect } from 'next/navigation'
import { isAdmin } from '@/lib/auth'
import { getAdminProductsAction } from '@/app/actions/admin-products'
import InventoryDashboardClient from './InventoryDashboardClient'

export default async function InventoryPage() {
  const adminAccess = await isAdmin()

  if (!adminAccess) {
    redirect('/login?redirect=/admin/inventory')
  }

  const result = await getAdminProductsAction()

  if (!result.success || !result.data) {
    return <div>Failed to load inventory data</div>
  }

  return <InventoryDashboardClient products={result.data.products} />
}
