'use server'

import { cookies } from 'next/headers'
import { verifyToken } from '@/lib/auth'
import { uploadFile } from '@/lib/minio'
import { updateOrderPaymentProof } from '@/lib/repositories/order.repository'
import type { ActionResponse } from '@/lib/types'

export async function uploadPaymentProofAction(
  orderId: string,
  formData: FormData
): Promise<ActionResponse<{ proofUrl: string }>> {
  try {
    // Verify authentication
    const cookieStore = await cookies()
    const token = cookieStore.get('auth_token')

    if (!token) {
      return {
        success: false,
        message: 'Authentication required',
      }
    }

    let userId: string
    try {
      const payload = await verifyToken(token.value)
      if (!payload) {
        return {
          success: false,
          message: 'Invalid authentication token',
        }
      }
      userId = payload.userId
    } catch {
      return {
        success: false,
        message: 'Invalid authentication',
      }
    }

    // Get the file from form data
    const file = formData.get('paymentProof') as File

    if (!file) {
      return {
        success: false,
        message: 'No file provided',
      }
    }

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'application/pdf']
    if (!allowedTypes.includes(file.type)) {
      return {
        success: false,
        message: 'Invalid file type. Please upload an image or PDF.',
      }
    }

    // Validate file size (max 5MB)
    const maxSize = 5 * 1024 * 1024 // 5MB
    if (file.size > maxSize) {
      return {
        success: false,
        message: 'File size too large. Maximum size is 5MB.',
      }
    }

    // Create unique filename
    const fileExtension = file.name.split('.').pop()
    const filename = `payment-proofs/payment-proof-${orderId}-${Date.now()}.${fileExtension}`

    // Convert file to buffer and upload to MinIO
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    const proofUrl = await uploadFile(buffer, filename, file.type)

    // Update order with payment proof
    await updateOrderPaymentProof(orderId, userId, proofUrl)

    return {
      success: true,
      data: { proofUrl },
      message: 'Payment proof uploaded successfully',
    }
  } catch (error) {
    console.error('Upload payment proof error:', error)
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Failed to upload payment proof',
    }
  }
}
