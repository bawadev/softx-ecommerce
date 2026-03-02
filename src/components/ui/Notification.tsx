'use client'

import { useEffect } from 'react'

export type NotificationType = 'success' | 'error' | 'warning' | 'info'

interface NotificationProps {
  type: NotificationType
  title: string
  message?: string
  isOpen: boolean
  onClose: () => void
  autoClose?: boolean
  autoCloseDelay?: number
  okLabel?: string
}

export default function Notification({
  type,
  title,
  message,
  isOpen,
  onClose,
  autoClose = false,
  autoCloseDelay = 3000,
  okLabel = 'OK',
}: NotificationProps) {
  useEffect(() => {
    if (isOpen && autoClose) {
      const timer = setTimeout(() => {
        onClose()
      }, autoCloseDelay)
      return () => clearTimeout(timer)
    }
  }, [isOpen, autoClose, autoCloseDelay, onClose])

  if (!isOpen) return null

  const styles = {
    success: {
      bg: 'bg-green-50',
      border: 'border-green-500',
      icon: 'text-green-600',
      title: 'text-green-900',
      message: 'text-green-700',
      button: 'bg-green-600 hover:bg-green-700',
      iconPath: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z',
    },
    error: {
      bg: 'bg-red-50',
      border: 'border-red-500',
      icon: 'text-red-600',
      title: 'text-red-900',
      message: 'text-red-700',
      button: 'bg-red-600 hover:bg-red-700',
      iconPath: 'M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z',
    },
    warning: {
      bg: 'bg-yellow-50',
      border: 'border-black-500',
      icon: 'text-black-600',
      title: 'text-black-900',
      message: 'text-black-700',
      button: 'bg-black-700 hover:bg-black-800',
      iconPath: 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z',
    },
    info: {
      bg: 'bg-gray-100',
      border: 'border-gray-500',
      icon: 'text-black-600',
      title: 'text-black-900',
      message: 'text-black-700',
      button: 'bg-black-700 hover:bg-black-800',
      iconPath: 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
    },
  }

  const style = styles[type]

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black bg-opacity-50 z-50 transition-opacity"
        onClick={onClose}
      />

      {/* Dialog */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div role="alert" aria-live="assertive" className={`${style.bg} ${style.border} border-2 rounded-xl shadow-2xl w-full max-w-md transform transition-all`}>
          {/* Header with Icon */}
          <div className="flex items-start gap-4 p-6 pb-4">
            <div className={`flex-shrink-0 w-12 h-12 rounded-full ${style.bg} flex items-center justify-center`}>
              <svg
                className={`w-6 h-6 ${style.icon}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d={style.iconPath}
                />
              </svg>
            </div>

            <div className="flex-1 min-w-0">
              <h3 className={`text-lg font-semibold ${style.title}`}>
                {title}
              </h3>
              {message && (
                <p className={`text-sm mt-2 ${style.message}`}>
                  {message}
                </p>
              )}
            </div>
          </div>

          {/* Footer with OK Button */}
          <div className="px-6 py-4 bg-white bg-opacity-50 rounded-b-xl">
            <button
              onClick={onClose}
              className={`w-full ${style.button} text-white font-semibold py-2.5 px-4 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2`}
            >
              {okLabel}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
