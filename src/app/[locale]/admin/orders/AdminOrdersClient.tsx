'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useLocale } from 'next-intl'
import { updateAdminOrderStatusAction } from '@/app/actions/admin-orders'
import type { OrderWithItems } from '@/lib/repositories/order.repository'
import type { OrderStatus } from '@/lib/types'
import Notification, { type NotificationType } from '@/components/ui/Notification'

interface AdminOrdersClientProps {
  orders: OrderWithItems[]
}

export default function AdminOrdersClient({ orders: initialOrders }: AdminOrdersClientProps) {
  const locale = useLocale()
  const [orders, setOrders] = useState(initialOrders)
  const [updatingId, setUpdatingId] = useState<string | null>(null)

  // Notification state
  const [notification, setNotification] = useState<{
    isOpen: boolean
    type: NotificationType
    title: string
    message?: string
  }>({
    isOpen: false,
    type: 'success',
    title: '',
  })

  const showNotification = (type: NotificationType, title: string, message?: string) => {
    setNotification({ isOpen: true, type, title, message })
  }

  const closeNotification = () => {
    setNotification(prev => ({ ...prev, isOpen: false }))
  }

  const handleStatusUpdate = async (orderId: string, newStatus: OrderStatus) => {
    setUpdatingId(orderId)

    const result = await updateAdminOrderStatusAction(orderId, newStatus)

    if (result.success) {
      setOrders(orders.map(o =>
        o.id === orderId
          ? { ...o, status: newStatus, updatedAt: new Date().toISOString() }
          : o
      ))
      showNotification('success', 'Order status updated successfully')
    } else {
      showNotification('error', 'Failed to update order status', result.message || 'Failed to update order status')
    }

    setUpdatingId(null)
  }

  const getStatusColor = (status: OrderStatus) => {
    switch (status) {
      case 'PENDING':
        return 'bg-gray-100 text-black-700'
      case 'CONFIRMED':
        return 'bg-gray-100 text-black-700'
      case 'FULFILLED':
        return 'bg-green-100 text-green-700'
      case 'CANCELLED':
        return 'bg-red-100 text-red-700'
      default:
        return 'bg-gray-100 text-gray-700'
    }
  }

  const pendingCount = orders.filter(o => o.status === 'PENDING').length
  const confirmedCount = orders.filter(o => o.status === 'CONFIRMED').length
  const fulfilledCount = orders.filter(o => o.status === 'FULFILLED').length
  const totalRevenue = orders.reduce((sum, o) => sum + o.totalAmount, 0)

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-black-700">Order Management</h1>
              <p className="mt-1 text-sm text-gray-600">Manage customer orders and fulfillment</p>
            </div>
            <Link href={`/${locale}/admin/dashboard`} className="text-sm text-black-700 hover:text-black-700 font-medium flex-shrink-0">
              ← Back to Dashboard
            </Link>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
            <p className="text-sm font-medium text-gray-600">Pending Orders</p>
            <p className="mt-2 text-3xl font-bold text-black-600">{pendingCount}</p>
          </div>
          <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
            <p className="text-sm font-medium text-gray-600">Confirmed Orders</p>
            <p className="mt-2 text-3xl font-bold text-black-600">{confirmedCount}</p>
          </div>
          <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
            <p className="text-sm font-medium text-gray-600">Fulfilled Orders</p>
            <p className="mt-2 text-3xl font-bold text-green-600">{fulfilledCount}</p>
          </div>
          <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
            <p className="text-sm font-medium text-gray-600">Total Revenue</p>
            <p className="mt-2 text-3xl font-bold text-black-700">Rs {totalRevenue.toFixed(2)}</p>
          </div>
        </div>
      </div>

      {/* Orders List */}
      <div className="mx-auto max-w-7xl px-4 pb-8 sm:px-6 lg:px-8">
        <div className="space-y-4">
          {orders.map((order) => {
            const orderDate = new Date(order.createdAt).toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })

            return (
              <div key={order.id} className="bg-white rounded-lg shadow-sm border border-gray-200">
                {/* Order Header */}
                <div className="border-b border-gray-200 px-4 sm:px-6 py-4">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div className="grid grid-cols-2 sm:flex sm:items-center gap-3 sm:gap-6">
                      <div>
                        <p className="text-xs text-gray-600">Order Number</p>
                        <p className="font-semibold text-black-700 text-sm sm:text-base">{order.orderNumber}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-600">Date</p>
                        <p className="text-sm text-black-700">{orderDate}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-600">Total</p>
                        <p className="text-sm font-semibold text-black-700">
                          Rs {order.totalAmount.toFixed(2)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-600">Items</p>
                        <p className="text-sm text-black-700">{order.items.length} items</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-600">Delivery</p>
                        <p className="text-sm text-black-700">
                          {order.deliveryMethod === 'SHIP' ? '📦 Ship' : '🏪 Collect'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className={`inline-block rounded-full px-3 py-1 text-xs font-semibold ${getStatusColor(order.status)}`}>
                        {order.status}
                      </span>
                      <Link
                        href={`/${locale}/order/${order.id}`}
                        className="text-sm font-medium text-black-700 hover:text-black-700"
                        target="_blank"
                      >
                        View Details →
                      </Link>
                    </div>
                  </div>
                </div>

                {/* Order Items */}
                <div className="px-6 py-4">
                  <div className="space-y-3 mb-4">
                    {order.items.map((item) => (
                      <div key={item.id} className="flex gap-3">
                        <div className="relative h-16 w-16 flex-shrink-0 overflow-hidden rounded-lg bg-gray-100">
                          {(item.variant.images?.[0] || item.product.images?.[0]) ? (
                            <Image
                              src={item.variant.images?.[0] || item.product.images[0]}
                              alt={item.product.name}
                              fill
                              className="object-cover"
                              sizes="64px"
                            />
                          ) : (
                            <div className="flex h-full items-center justify-center text-gray-400 text-xs">
                              No Image
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-black-700 truncate">{item.product.name}</p>
                          <p className="text-xs text-gray-600">{item.product.brand}</p>
                          <p className="text-xs text-gray-500">
                            Size: {item.variant.size} • Color: {item.variant.color} • Qty: {item.quantity}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-semibold text-black-700">
                            Rs {(item.priceAtPurchase * item.quantity).toFixed(2)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Shipping Address */}
                  <div className="border-t border-gray-200 pt-4 mb-4">
                    <p className="text-xs font-medium text-gray-600 mb-2">Shipping Address</p>
                    <div className="text-sm text-black-700">
                      <p className="font-medium">{order.shippingAddress.fullName}</p>
                      <p>{order.shippingAddress.addressLine1}</p>
                      {order.shippingAddress.addressLine2 && <p>{order.shippingAddress.addressLine2}</p>}
                      <p>
                        {order.shippingAddress.city}, {order.shippingAddress.state} {order.shippingAddress.postalCode}
                      </p>
                      <p>{order.shippingAddress.country}</p>
                      <p className="mt-1 text-gray-600">Phone: {order.shippingAddress.phone}</p>
                    </div>
                  </div>

                  {/* Status Actions */}
                  <div className="border-t border-gray-200 pt-4">
                    <p className="text-xs font-medium text-gray-600 mb-2">Update Status</p>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleStatusUpdate(order.id, 'CONFIRMED')}
                        disabled={updatingId === order.id || order.status === 'CONFIRMED'}
                        className="px-3 py-1 text-xs font-medium text-white bg-black-700 rounded hover:bg-black-800 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Confirm
                      </button>
                      <button
                        onClick={() => handleStatusUpdate(order.id, 'FULFILLED')}
                        disabled={updatingId === order.id || order.status === 'FULFILLED'}
                        className="px-3 py-1 text-xs font-medium text-white bg-green-600 rounded hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Mark as Fulfilled
                      </button>
                      <button
                        onClick={() => handleStatusUpdate(order.id, 'CANCELLED')}
                        disabled={updatingId === order.id || order.status === 'CANCELLED' || order.status === 'FULFILLED'}
                        className="px-3 py-1 text-xs font-medium text-white bg-red-600 rounded hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Cancel
                      </button>
                      {updatingId === order.id && (
                        <span className="text-xs text-gray-500">Updating...</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {orders.length === 0 && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
            <svg
              className="mx-auto h-12 w-12 text-gray-400"
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
            <h3 className="mt-2 text-sm font-medium text-black-700">No orders</h3>
            <p className="mt-1 text-sm text-gray-500">Orders will appear here when customers place them.</p>
          </div>
        )}

        {/* Summary */}
        {orders.length > 0 && (
          <div className="mt-6 text-sm text-gray-600">
            <p>Showing {orders.length} orders</p>
          </div>
        )}
      </div>

      {/* Notification */}
      <Notification
        type={notification.type}
        title={notification.title}
        message={notification.message}
        isOpen={notification.isOpen}
        onClose={closeNotification}
      />
    </div>
  )
}
