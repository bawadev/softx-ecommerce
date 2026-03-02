'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useTranslations, useLocale } from 'next-intl'
import type { OrderWithItems } from '@/lib/repositories/order.repository'
import Notification, { type NotificationType } from '@/components/ui/Notification'

interface PaymentPageClientProps {
  order: OrderWithItems
}

export default function PaymentPageClient({ order }: PaymentPageClientProps) {
  const locale = useLocale()
  const t = useTranslations('payment')
  const tCommon = useTranslations('common')
  const [paymentProof, setPaymentProof] = useState<File | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadSuccess, setUploadSuccess] = useState(false)

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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setPaymentProof(e.target.files[0])
    }
  }

  const handleUpload = async () => {
    if (!paymentProof) return

    setIsUploading(true)

    try {
      const formData = new FormData()
      formData.append('paymentProof', paymentProof)

      const { uploadPaymentProofAction } = await import('@/app/actions/payment')
      const result = await uploadPaymentProofAction(order.id, formData)

      if (result.success) {
        setUploadSuccess(true)
        showNotification('success', 'Payment proof uploaded successfully!')
      } else {
        showNotification('error', 'Failed to upload payment proof', result.message || 'Failed to upload payment proof')
      }
    } catch (error) {
      console.error('Upload error:', error)
      showNotification('error', 'Upload error', 'An error occurred while uploading the payment proof')
    } finally {
      setIsUploading(false)
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    showNotification('success', 'Copied to clipboard!')
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <h1 className="text-3xl font-bold text-black-900">{t('title')}</h1>
          <p className="mt-2 text-gray-600">
            {t('orderNumber')}: <span className="font-semibold">{order.orderNumber}</span>
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
          {/* Payment Instructions */}
          <div className="lg:col-span-2 space-y-6">
            {/* Bank Details */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">{t('bankDetails')}</h2>
              <div className="space-y-4">
                <div className="flex justify-between items-center p-4 bg-gray-50 rounded-lg">
                  <div>
                    <p className="text-sm text-gray-600">{t('bankName')}</p>
                    <p className="text-lg font-semibold text-gray-900">Bank of Ceylon</p>
                  </div>
                  <button
                    onClick={() => copyToClipboard('Bank of Ceylon')}
                    className="text-sm text-black-700 hover:text-black-800"
                  >
                    📋 {tCommon('copy')}
                  </button>
                </div>

                <div className="flex justify-between items-center p-4 bg-gray-50 rounded-lg">
                  <div>
                    <p className="text-sm text-gray-600">{t('accountNumber')}</p>
                    <p className="text-lg font-semibold text-gray-900">1234567890</p>
                  </div>
                  <button
                    onClick={() => copyToClipboard('1234567890')}
                    className="text-sm text-black-700 hover:text-black-800"
                  >
                    📋 {tCommon('copy')}
                  </button>
                </div>

                <div className="flex justify-between items-center p-4 bg-gray-50 rounded-lg">
                  <div>
                    <p className="text-sm text-gray-600">{t('accountName')}</p>
                    <p className="text-lg font-semibold text-gray-900">Ecom (Pvt) Ltd</p>
                  </div>
                  <button
                    onClick={() => copyToClipboard('Ecom (Pvt) Ltd')}
                    className="text-sm text-black-700 hover:text-black-800"
                  >
                    📋 {tCommon('copy')}
                  </button>
                </div>

                <div className="flex justify-between items-center p-4 bg-gray-50 rounded-lg">
                  <div>
                    <p className="text-sm text-gray-600">{t('branch')}</p>
                    <p className="text-lg font-semibold text-gray-900">Colombo Branch</p>
                  </div>
                  <button
                    onClick={() => copyToClipboard('Colombo Branch')}
                    className="text-sm text-black-700 hover:text-black-800"
                  >
                    📋 {tCommon('copy')}
                  </button>
                </div>

                <div className="p-4 bg-gray-100 border border-gray-200 rounded-lg">
                  <p className="text-sm text-black-900 font-medium">{t('paymentAmount')}</p>
                  <p className="text-3xl font-bold text-black-600 mt-1">
                    Rs {order.totalAmount.toFixed(2)}
                  </p>
                  <p className="text-xs text-black-700 mt-2">{t('paymentNote')}</p>
                </div>
              </div>
            </div>

            {/* QR Code (placeholder) */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">{t('qrPayment')}</h2>
              <div className="flex flex-col items-center justify-center p-8 bg-gray-50 rounded-lg">
                <div className="w-64 h-64 bg-white border-2 border-gray-300 rounded-lg flex items-center justify-center">
                  <p className="text-gray-400 text-center">{t('qrPlaceholder')}</p>
                </div>
                <p className="mt-4 text-sm text-gray-600 text-center">{t('qrDescription')}</p>
              </div>
            </div>

            {/* Upload Payment Proof */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">{t('uploadProof')}</h2>
              {uploadSuccess ? (
                <div className="p-6 bg-green-50 border border-green-200 rounded-lg text-center">
                  <svg
                    className="mx-auto h-16 w-16 text-green-600 mb-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  <p className="text-lg font-semibold text-green-900">{t('uploadSuccess')}</p>
                  <p className="text-sm text-green-700 mt-2">{t('uploadSuccessMessage')}</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-6">
                    <input
                      type="file"
                      accept="image/*,.pdf"
                      onChange={handleFileChange}
                      className="block w-full text-sm text-gray-500
                        file:mr-4 file:py-2 file:px-4
                        file:rounded-lg file:border-0
                        file:text-sm file:font-semibold
                        file:bg-gray-50 file:text-black-800
                        hover:file:bg-navy-100
                        cursor-pointer"
                    />
                    <p className="mt-2 text-xs text-gray-500">{t('uploadInstructions')}</p>
                  </div>

                  {paymentProof && (
                    <div className="p-4 bg-gray-50 rounded-lg">
                      <p className="text-sm text-gray-900">
                        {t('selectedFile')}: <span className="font-semibold">{paymentProof.name}</span>
                      </p>
                      <p className="text-xs text-gray-500">
                        {(paymentProof.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                    </div>
                  )}

                  <button
                    onClick={handleUpload}
                    disabled={!paymentProof || isUploading}
                    className="w-full btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isUploading ? t('uploading') : t('uploadButton')}
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Order Summary Sidebar */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow-sm p-6 sticky top-4">
              <h2 className="text-lg font-bold text-gray-900 mb-4">{t('orderSummary')}</h2>

              {/* Items */}
              <div className="space-y-3 mb-4">
                {order.items.map((item) => (
                  <div key={item.id} className="flex gap-3">
                    <div className="relative h-16 w-16 flex-shrink-0 overflow-hidden rounded-lg bg-gray-100">
                      {item.variant.images?.[0] ? (
                        <Image
                          src={item.variant.images[0]}
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
                      <p className="text-sm font-medium text-gray-900 truncate">{item.product.name}</p>
                      <p className="text-xs text-gray-600">{item.product.brand}</p>
                      <p className="text-xs text-gray-500">Qty: {item.quantity}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Totals */}
              <div className="border-t border-gray-200 pt-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">{t('total')}</span>
                  <span className="font-bold text-gray-900">Rs {order.totalAmount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-gray-600">{t('deliveryMethod')}</span>
                  <span className="text-gray-900">
                    {order.deliveryMethod === 'SHIP' ? '📦 Ship' : '🏪 Collect'}
                  </span>
                </div>
              </div>

              <div className="mt-6 space-y-2">
                <Link
                  href={`/${locale}/order/${order.id}`}
                  className="block w-full text-center btn-secondary"
                >
                  ← {t('backToOrder')}
                </Link>
              </div>
            </div>
          </div>
        </div>
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
