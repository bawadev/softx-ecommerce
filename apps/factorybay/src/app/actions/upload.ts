'use server'

/**
 * File Upload Server Actions
 * Handles image uploads for products
 */

import { uploadFile, uploadMultipleFiles, deleteFile } from '@/lib/minio'
import { isAdmin } from '@/lib/auth'

export interface UploadResponse {
  success: boolean
  message?: string
  url?: string
  urls?: string[]
}

/**
 * Upload a single image file
 */
export async function uploadImage(formData: FormData): Promise<UploadResponse> {
  try {
    // Check admin authentication
    const adminAccess = await isAdmin()
    if (!adminAccess) {
      return {
        success: false,
        message: 'Unauthorized: Admin access required',
      }
    }

    const file = formData.get('file') as File
    if (!file) {
      return {
        success: false,
        message: 'No file provided',
      }
    }

    // Validate file type - support most common image formats
    const allowedTypes = [
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/webp',
      'image/gif',
      'image/bmp',
      'image/tiff',
      'image/svg+xml',
      'image/avif'
    ]
    if (!allowedTypes.includes(file.type)) {
      return {
        success: false,
        message: 'Invalid file type. Only image files are allowed (JPEG, PNG, WebP, GIF, BMP, TIFF, SVG, AVIF).',
      }
    }

    // Validate file size (max 5MB)
    const maxSize = 5 * 1024 * 1024 // 5MB
    if (file.size > maxSize) {
      return {
        success: false,
        message: 'File size exceeds 5MB limit',
      }
    }

    // Convert file to buffer
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    // Upload to MinIO
    const url = await uploadFile(buffer, file.name, file.type)

    return {
      success: true,
      message: 'Image uploaded successfully',
      url,
    }
  } catch (error) {
    console.error('Upload error:', error)
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Failed to upload image',
    }
  }
}

/**
 * Upload multiple image files
 */
export async function uploadMultipleImages(formData: FormData): Promise<UploadResponse> {
  try {
    // Check admin authentication
    const adminAccess = await isAdmin()
    if (!adminAccess) {
      return {
        success: false,
        message: 'Unauthorized: Admin access required',
      }
    }

    const files = formData.getAll('files') as File[]
    if (!files || files.length === 0) {
      return {
        success: false,
        message: 'No files provided',
      }
    }

    // Validate number of files (max 10)
    if (files.length > 10) {
      return {
        success: false,
        message: 'Maximum 10 files can be uploaded at once',
      }
    }

    // Validate and convert files
    const allowedTypes = [
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/webp',
      'image/gif',
      'image/bmp',
      'image/tiff',
      'image/svg+xml',
      'image/avif'
    ]
    const maxSize = 5 * 1024 * 1024 // 5MB

    const fileBuffers = []

    for (const file of files) {
      // Validate file type
      if (!allowedTypes.includes(file.type)) {
        return {
          success: false,
          message: `Invalid file type for ${file.name}. Only image files are allowed (JPEG, PNG, WebP, GIF, BMP, TIFF, SVG, AVIF).`,
        }
      }

      // Validate file size
      if (file.size > maxSize) {
        return {
          success: false,
          message: `File ${file.name} exceeds 5MB limit`,
        }
      }

      // Convert to buffer
      const bytes = await file.arrayBuffer()
      const buffer = Buffer.from(bytes)

      fileBuffers.push({
        buffer,
        fileName: file.name,
        contentType: file.type,
      })
    }

    // Upload all files to MinIO
    const urls = await uploadMultipleFiles(fileBuffers)

    return {
      success: true,
      message: `${urls.length} image(s) uploaded successfully`,
      urls,
    }
  } catch (error) {
    console.error('Upload error:', error)
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Failed to upload images',
    }
  }
}

/**
 * Delete an image file
 */
export async function deleteImage(fileUrl: string): Promise<UploadResponse> {
  try {
    // Check admin authentication
    const adminAccess = await isAdmin()
    if (!adminAccess) {
      return {
        success: false,
        message: 'Unauthorized: Admin access required',
      }
    }

    if (!fileUrl) {
      return {
        success: false,
        message: 'No file URL provided',
      }
    }

    // Delete from MinIO
    await deleteFile(fileUrl)

    return {
      success: true,
      message: 'Image deleted successfully',
    }
  } catch (error) {
    console.error('Delete error:', error)
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Failed to delete image',
    }
  }
}
