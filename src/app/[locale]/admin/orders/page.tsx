import { redirect } from 'next/navigation'
import { isAdmin } from '@/lib/auth'
import { getAdminOrdersAction } from '@/app/actions/admin-orders'
import AdminOrdersClient from './AdminOrdersClient'

export default async function AdminOrdersPage() {
  const adminAccess = await isAdmin()

  if (!adminAccess) {
    redirect('/login?redirect=/admin/orders')
  }

  const result = await getAdminOrdersAction()

  if (!result.success || !result.data) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <h1 className="text-3xl font-bold text-black-700">Order Management</h1>
          <div className="mt-8 text-center">
            <p className="text-gray-600">{result.message || 'Failed to load orders'}</p>
          </div>
        </div>
      </div>
    )
  }

  return <AdminOrdersClient orders={result.data.orders} />
}
