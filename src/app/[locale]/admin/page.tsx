import { redirect } from 'next/navigation'
import { isAdmin } from '@/lib/auth'
import { getTranslations, getLocale } from 'next-intl/server'
import Link from 'next/link'
import { getProductCount } from '@/lib/repositories/product.repository'

export default async function AdminDashboardPage() {
  const adminAccess = await isAdmin()
  const locale = await getLocale()

  if (!adminAccess) {
    redirect(`/${locale}/login?redirect=/${locale}/admin`)
  }

  const t = await getTranslations('admin.dashboard')

  // Fetch actual stats
  const totalProducts = await getProductCount()

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-black-900">{t('title')}</h1>
              <p className="mt-1 text-sm text-gray-600">Manage your Ecom store</p>
            </div>
            <Link href={`/${locale}`} className="text-sm text-black-700 hover:text-black-800 font-medium">
              ← Back to Store
            </Link>
          </div>
        </div>
      </div>

      {/* Dashboard Content */}
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {/* Products Card */}
          <Link
            href={`/${locale}/admin/products`}
            className="group relative bg-white p-6 rounded-lg shadow-sm hover:shadow-md transition-shadow border border-gray-200"
          >
            <div className="flex items-center mb-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-black-700 group-hover:bg-black-800 transition-colors">
                <svg
                  className="h-6 w-6 text-white"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
                  />
                </svg>
              </div>
              <h2 className="ml-4 text-xl font-semibold text-gray-900">Products</h2>
            </div>
            <p className="text-sm text-gray-600">
              Manage your product catalog, add new products, update inventory, and more.
            </p>
            <div className="mt-4 flex items-center text-sm font-medium text-black-700 group-hover:text-black-800">
              {t('manageProducts')}
              <svg className="ml-2 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </Link>

          {/* Orders Card */}
          <Link
            href={`/${locale}/admin/orders`}
            className="group relative bg-white p-6 rounded-lg shadow-sm hover:shadow-md transition-shadow border border-gray-200"
          >
            <div className="flex items-center mb-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-green-600 group-hover:bg-green-700 transition-colors">
                <svg
                  className="h-6 w-6 text-white"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                  />
                </svg>
              </div>
              <h2 className="ml-4 text-xl font-semibold text-gray-900">Orders</h2>
            </div>
            <p className="text-sm text-gray-600">
              View and manage customer orders, update order status, and track fulfillment.
            </p>
            <div className="mt-4 flex items-center text-sm font-medium text-green-600 group-hover:text-green-700">
              {t('manageOrders')}
              <svg className="ml-2 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </Link>

          {/* Inventory Card */}
          <Link
            href={`/${locale}/admin/inventory`}
            className="group relative bg-white p-6 rounded-lg shadow-sm hover:shadow-md transition-shadow border border-gray-200"
          >
            <div className="flex items-center mb-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-black-700 group-hover:bg-black-800 transition-colors">
                <svg
                  className="h-6 w-6 text-white"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
              </div>
              <h2 className="ml-4 text-xl font-semibold text-gray-900">Inventory</h2>
            </div>
            <p className="text-sm text-gray-600">
              Track stock levels, view low inventory alerts, and manage product variants.
            </p>
            <div className="mt-4 flex items-center text-sm font-medium text-black-600 group-hover:text-black-700">
              {t('viewInventory')}
              <svg className="ml-2 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </Link>

          {/* Promotional Sections Card */}
          <Link
            href={`/${locale}/admin/sections`}
            className="group relative bg-white p-6 rounded-lg shadow-sm hover:shadow-md transition-shadow border border-gray-200"
          >
            <div className="flex items-center mb-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-black-700 group-hover:bg-black-800 transition-colors">
                <svg
                  className="h-6 w-6 text-white"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"
                  />
                </svg>
              </div>
              <h2 className="ml-4 text-xl font-semibold text-gray-900">Promotional Sections</h2>
            </div>
            <p className="text-sm text-gray-600">
              Create and manage promotional sections like &quot;Best Sellers&quot;, &quot;New Arrivals&quot;, and seasonal offers.
            </p>
            <div className="mt-4 flex items-center text-sm font-medium text-black-600 group-hover:text-black-700">
              Manage Sections
              <svg className="ml-2 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </Link>

          {/* Hero Slides Card */}
          <Link
            href={`/${locale}/admin/hero-slides`}
            className="group relative bg-white p-6 rounded-lg shadow-sm hover:shadow-md transition-shadow border border-gray-200"
          >
            <div className="flex items-center mb-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-black-700 group-hover:bg-black-800 transition-colors">
                <svg
                  className="h-6 w-6 text-white"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                  />
                </svg>
              </div>
              <h2 className="ml-4 text-xl font-semibold text-gray-900">Hero Slides</h2>
            </div>
            <p className="text-sm text-gray-600">
              Manage homepage hero slider images, animations, and text content.
            </p>
            <div className="mt-4 flex items-center text-sm font-medium text-black-600 group-hover:text-black-700">
              Manage Slides
              <svg className="ml-2 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </Link>

          {/* Custom Filters Card */}
          <Link
            href={`/${locale}/admin/filters`}
            className="group relative bg-white p-6 rounded-lg shadow-sm hover:shadow-md transition-shadow border border-gray-200"
          >
            <div className="flex items-center mb-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-black-700 group-hover:bg-black-800 transition-colors">
                <svg
                  className="h-6 w-6 text-white"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"
                  />
                </svg>
              </div>
              <h2 className="ml-4 text-xl font-semibold text-gray-900">Category Management</h2>
            </div>
            <p className="text-sm text-gray-600">
              Define hierarchical filters to organize products by custom categories like &quot;Office Wares&quot; or &quot;Evening Dresses&quot;.
            </p>
            <div className="mt-4 flex items-center text-sm font-medium text-black-700 group-hover:text-indigo-700">
              Manage Filters
              <svg className="ml-2 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </Link>
        </div>

        {/* Quick Stats */}
        <div className="mt-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Stats</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
              <p className="text-sm font-medium text-gray-600">{t('totalProducts')}</p>
              <p className="mt-2 text-3xl font-bold text-gray-900">{totalProducts}</p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
              <p className="text-sm font-medium text-gray-600">{t('pendingOrders')}</p>
              <p className="mt-2 text-3xl font-bold text-black-600">-</p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
              <p className="text-sm font-medium text-gray-600">Low Stock Items</p>
              <p className="mt-2 text-3xl font-bold text-red-600">-</p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
              <p className="text-sm font-medium text-gray-600">{t('totalRevenue')}</p>
              <p className="mt-2 text-3xl font-bold text-green-600">Rs -</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
