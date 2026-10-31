/**
 * MinIO Client Configuration and Utilities
 * Handles file upload/download operations with MinIO object storage
 */

import * as Minio from 'minio'
import sharp from 'sharp'

// MinIO client configuration
const minioConfig = {
  endPoint: process.env.MINIO_ENDPOINT || 'localhost',
  port: parseInt(process.env.MINIO_PORT || '9000'),
  useSSL: process.env.MINIO_USE_SSL === 'true',
  accessKey: process.env.MINIO_ACCESS_KEY || 'ecommerce',
  secretKey: process.env.MINIO_SECRET_KEY || 'ecommerce123',
}

const bucketName = process.env.MINIO_BUCKET_NAME || 'product-images'

// Create MinIO client instance
let minioClient: Minio.Client | null = null

export function getMinioClient(): Minio.Client {
  if (!minioClient) {
    minioClient = new Minio.Client(minioConfig)
  }
  return minioClient
}

/**
 * Convert image to WebP format with optimization
 * @param buffer - Original image buffer
 * @param contentType - Original content type
 * @returns Converted WebP buffer
 */
async function convertToWebP(buffer: Buffer, contentType: string): Promise<Buffer> {
  // Check if it's an image
  if (!contentType.startsWith('image/')) {
    return buffer
  }

  // Skip SVG files (vector graphics don't benefit from WebP conversion)
  if (contentType === 'image/svg+xml') {
    return buffer
  }

  try {
    // Convert to WebP with optimization
    const webpBuffer = await sharp(buffer)
      .webp({ quality: 85, effort: 6 }) // High quality with good compression
      .toBuffer()

    return webpBuffer
  } catch (error) {
    console.error('❌ Error converting to WebP, using original:', error)
    return buffer // Return original if conversion fails
  }
}

/**
 * Initialize MinIO bucket (creates if doesn't exist)
 */
export async function initializeBucket(): Promise<void> {
  const client = getMinioClient()

  try {
    const exists = await client.bucketExists(bucketName)

    if (!exists) {
      await client.makeBucket(bucketName, 'us-east-1')

      // Set bucket policy to allow public read access
      const policy = {
        Version: '2012-10-17',
        Statement: [
          {
            Effect: 'Allow',
            Principal: { AWS: ['*'] },
            Action: ['s3:GetObject'],
            Resource: [`arn:aws:s3:::${bucketName}/*`],
          },
        ],
      }

      await client.setBucketPolicy(bucketName, JSON.stringify(policy))
    } else {
    }
  } catch (error) {
    console.error('❌ Error initializing MinIO bucket:', error)
    throw error
  }
}

/**
 * Upload a file to MinIO
 * @param file - File buffer or stream
 * @param fileName - Name to save the file as
 * @param contentType - MIME type of the file
 * @returns URL to access the uploaded file
 */
export async function uploadFile(
  file: Buffer,
  fileName: string,
  contentType: string = 'application/octet-stream'
): Promise<string> {
  const client = getMinioClient()

  try {
    // Ensure bucket exists
    await initializeBucket()

    // Convert image to WebP if it's an image (except SVG)
    let processedBuffer = file
    let finalContentType = contentType
    let finalFileName = fileName

    if (contentType.startsWith('image/') && contentType !== 'image/svg+xml') {
      processedBuffer = await convertToWebP(file, contentType)
      finalContentType = 'image/webp'
      // Change file extension to .webp
      const fileNameWithoutExt = fileName.replace(/\.[^/.]+$/, '')
      finalFileName = `${fileNameWithoutExt}.webp`
    }

    // Generate unique filename with timestamp
    const timestamp = Date.now()
    const uniqueFileName = `${timestamp}-${finalFileName}`

    // Upload file
    await client.putObject(bucketName, uniqueFileName, processedBuffer, processedBuffer.length, {
      'Content-Type': finalContentType,
    })

    // Construct and return public URL
    const publicUrl = `${process.env.NEXT_PUBLIC_MINIO_URL}/${bucketName}/${uniqueFileName}`

    return publicUrl
  } catch (error) {
    console.error('❌ Error uploading file:', error)
    throw error
  }
}

/**
 * Upload multiple files to MinIO
 * @param files - Array of file objects with buffer and metadata
 * @returns Array of URLs to access the uploaded files
 */
export async function uploadMultipleFiles(
  files: Array<{ buffer: Buffer; fileName: string; contentType: string }>
): Promise<string[]> {
  const uploadPromises = files.map((file) =>
    uploadFile(file.buffer, file.fileName, file.contentType)
  )

  return Promise.all(uploadPromises)
}

/**
 * Delete a file from MinIO
 * @param fileUrl - Full URL of the file to delete
 */
export async function deleteFile(fileUrl: string): Promise<void> {
  const client = getMinioClient()

  try {
    // Extract filename from URL
    const fileName = fileUrl.split('/').pop()

    if (!fileName) {
      throw new Error('Invalid file URL')
    }

    await client.removeObject(bucketName, fileName)
  } catch (error) {
    console.error('❌ Error deleting file:', error)
    throw error
  }
}

/**
 * Delete multiple files from MinIO
 * @param fileUrls - Array of file URLs to delete
 */
export async function deleteMultipleFiles(fileUrls: string[]): Promise<void> {
  const client = getMinioClient()

  try {
    const fileNames = fileUrls
      .map((url) => url.split('/').pop())
      .filter((name): name is string => name !== undefined)

    await client.removeObjects(bucketName, fileNames)
  } catch (error) {
    console.error('❌ Error deleting files:', error)
    throw error
  }
}

/**
 * Get a presigned URL for temporary file access
 * @param fileName - Name of the file
 * @param expirySeconds - Expiry time in seconds (default: 24 hours)
 * @returns Presigned URL
 */
export async function getPresignedUrl(
  fileName: string,
  expirySeconds: number = 86400
): Promise<string> {
  const client = getMinioClient()

  try {
    const url = await client.presignedGetObject(bucketName, fileName, expirySeconds)
    return url
  } catch (error) {
    console.error('❌ Error generating presigned URL:', error)
    throw error
  }
}

/**
 * List all files in the bucket
 * @param prefix - Optional prefix to filter files
 * @returns Array of file objects
 */
export async function listFiles(prefix: string = ''): Promise<Minio.BucketItem[]> {
  const client = getMinioClient()

  return new Promise((resolve, reject) => {
    const files: Minio.BucketItem[] = []
    const stream = client.listObjects(bucketName, prefix, true)

    stream.on('data', (obj) => {
      if (obj.name) {
        files.push(obj as Minio.BucketItem)
      }
    })
    stream.on('error', reject)
    stream.on('end', () => resolve(files))
  })
}

/**
 * Get file stats (metadata)
 * @param fileName - Name of the file
 * @returns File metadata
 */
export async function getFileStats(fileName: string): Promise<Minio.BucketItemStat> {
  const client = getMinioClient()

  try {
    const stats = await client.statObject(bucketName, fileName)
    return stats
  } catch (error) {
    console.error('❌ Error getting file stats:', error)
    throw error
  }
}
