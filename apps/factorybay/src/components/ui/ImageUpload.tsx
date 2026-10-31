'use client'

/**
 * Image Upload Component
 * Reusable component for uploading images with preview or adding via URL
 */

import { useState, useRef, useId } from 'react'
import { uploadImage, uploadMultipleImages } from '@/app/actions/upload'
import { X, Upload, Image as ImageIcon, Link as LinkIcon } from 'lucide-react'

interface ImageUploadProps {
  multiple?: boolean
  maxFiles?: number
  onUploadComplete: (urls: string[]) => void
  initialImages?: string[]
  label?: string
}

type UploadMode = 'file' | 'url'

export default function ImageUpload({
  multiple = false,
  maxFiles = 5,
  onUploadComplete,
  initialImages = [],
  label = 'Product Images',
}: ImageUploadProps) {
  const [images, setImages] = useState<string[]>(initialImages)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [previewFiles, setPreviewFiles] = useState<File[]>([])
  const [isDragging, setIsDragging] = useState(false)
  const [uploadMode, setUploadMode] = useState<UploadMode>('file')
  const [urlInput, setUrlInput] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const uniqueId = useId()

  const validateAndSetFiles = (files: File[]) => {
    if (files.length === 0) return false

    // Check max files limit
    if (multiple && images.length + files.length > maxFiles) {
      setError(`Maximum ${maxFiles} images allowed`)
      return false
    }

    if (!multiple && files.length > 1) {
      setError('Only one image allowed')
      return false
    }

    // Validate file types - support most common image formats
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
    const invalidFiles = files.filter((file) => !allowedTypes.includes(file.type))

    if (invalidFiles.length > 0) {
      setError('Only image files are allowed (JPEG, PNG, WebP, GIF, BMP, TIFF, SVG, AVIF)')
      return false
    }

    // Validate file sizes (5MB max)
    const maxSize = 5 * 1024 * 1024
    const oversizedFiles = files.filter((file) => file.size > maxSize)

    if (oversizedFiles.length > 0) {
      setError('One or more files exceed 5MB limit')
      return false
    }

    setError(null)
    setPreviewFiles(files)
    return true
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    validateAndSetFiles(files)
  }

  const handleUploadAreaClick = () => {
    fileInputRef.current?.click()
  }

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)

    const files = Array.from(e.dataTransfer.files)
    validateAndSetFiles(files)
  }

  const handleUpload = async () => {
    if (previewFiles.length === 0) return

    setUploading(true)
    setError(null)

    try {
      const formData = new FormData()

      if (multiple) {
        previewFiles.forEach((file) => {
          formData.append('files', file)
        })

        const result = await uploadMultipleImages(formData)

        if (result.success && result.urls) {
          const newImages = [...images, ...result.urls]
          setImages(newImages)
          onUploadComplete(newImages)
          setPreviewFiles([])

          // Reset file input
          if (fileInputRef.current) {
            fileInputRef.current.value = ''
          }
        } else {
          setError(result.message || 'Upload failed')
        }
      } else {
        formData.append('file', previewFiles[0])

        const result = await uploadImage(formData)

        if (result.success && result.url) {
          const newImages = [result.url]
          setImages(newImages)
          onUploadComplete(newImages)
          setPreviewFiles([])

          // Reset file input
          if (fileInputRef.current) {
            fileInputRef.current.value = ''
          }
        } else {
          setError(result.message || 'Upload failed')
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  const handleRemoveImage = (index: number) => {
    const newImages = images.filter((_, i) => i !== index)
    setImages(newImages)
    onUploadComplete(newImages)
  }

  const handleRemovePreview = (index: number) => {
    const newPreviews = previewFiles.filter((_, i) => i !== index)
    setPreviewFiles(newPreviews)
  }

  const validateUrl = (url: string): boolean => {
    try {
      new URL(url)
      // Basic check for image file extension or common image hosting domains
      const imageExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp', '.svg', '.avif']
      const lowerUrl = url.toLowerCase()
      return imageExtensions.some(ext => lowerUrl.includes(ext)) ||
             lowerUrl.includes('imgur') ||
             lowerUrl.includes('cloudinary') ||
             lowerUrl.includes('unsplash') ||
             lowerUrl.includes('images') ||
             lowerUrl.includes('media')
    } catch {
      return false
    }
  }

  const handleAddUrl = () => {
    const trimmedUrl = urlInput.trim()

    if (!trimmedUrl) {
      setError('Please enter an image URL')
      return
    }

    if (!validateUrl(trimmedUrl)) {
      setError('Please enter a valid image URL')
      return
    }

    // Check max files limit
    if (multiple && images.length >= maxFiles) {
      setError(`Maximum ${maxFiles} images allowed`)
      return
    }

    if (!multiple && images.length > 0) {
      setError('Only one image allowed')
      return
    }

    // Add URL to images
    const newImages = multiple ? [...images, trimmedUrl] : [trimmedUrl]
    setImages(newImages)
    onUploadComplete(newImages)
    setUrlInput('')
    setError(null)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <label className="block text-sm font-medium text-gray-700">{label}</label>

        {/* Mode Toggle */}
        {previewFiles.length === 0 && (
          <div className="flex items-center gap-2 bg-gray-100 rounded-lg p-1">
            <button
              type="button"
              onClick={() => {
                setUploadMode('file')
                setError(null)
              }}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                uploadMode === 'file'
                  ? 'bg-white text-black-700 shadow-sm'
                  : 'text-gray-600 hover:text-black-700'
              }`}
            >
              <Upload className="w-3 h-3 inline mr-1" />
              Upload
            </button>
            <button
              type="button"
              onClick={() => {
                setUploadMode('url')
                setError(null)
              }}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                uploadMode === 'url'
                  ? 'bg-white text-black-700 shadow-sm'
                  : 'text-gray-600 hover:text-black-700'
              }`}
            >
              <LinkIcon className="w-3 h-3 inline mr-1" />
              URL
            </button>
          </div>
        )}
      </div>

      {/* Uploaded Images */}
      {images.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {images.map((url, index) => (
            <div key={url} className="relative group">
              <img
                src={url}
                alt={`Uploaded ${index + 1}`}
                className="w-full h-32 object-cover rounded-lg border border-gray-300"
              />
              <button
                type="button"
                onClick={() => handleRemoveImage(index)}
                className="absolute top-2 right-2 bg-red-500 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Preview Files (before upload) */}
      {previewFiles.length > 0 && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {previewFiles.map((file, index) => (
              <div key={index} className="relative group">
                <img
                  src={URL.createObjectURL(file)}
                  alt={`Preview ${index + 1}`}
                  className="w-full h-32 object-cover rounded-lg border-2 border-dashed border-gray-400"
                />
                <button
                  type="button"
                  onClick={() => handleRemovePreview(index)}
                  className="absolute top-2 right-2 bg-red-500 text-white p-1 rounded-full"
                >
                  <X className="w-4 h-4" />
                </button>
                <div className="absolute bottom-2 left-2 bg-black bg-opacity-50 text-white px-2 py-1 rounded text-xs">
                  {(file.size / 1024).toFixed(0)} KB
                </div>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={handleUpload}
            disabled={uploading}
            className="w-full px-4 py-2 bg-black-700 text-white rounded-lg hover:bg-black-800 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
          >
            {uploading ? 'Uploading...' : `Upload ${previewFiles.length} Image(s)`}
          </button>
        </div>
      )}

      {/* URL Input Mode */}
      {uploadMode === 'url' && previewFiles.length === 0 && (!multiple || images.length < maxFiles) && (
        <div className="space-y-3">
          <div className="flex gap-2">
            <input
              type="url"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  handleAddUrl()
                }
              }}
              placeholder="https://example.com/image.jpg"
              className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-black-700 focus:border-transparent text-sm"
            />
            <button
              type="button"
              onClick={handleAddUrl}
              className="px-4 py-2 bg-black-700 text-white rounded-md hover:bg-black-800 transition-colors text-sm font-medium"
            >
              Add URL
            </button>
          </div>
          <p className="text-xs text-gray-500">
            Enter a direct image URL (e.g., from Imgur, Cloudinary, or any publicly accessible image)
          </p>
        </div>
      )}

      {/* File Upload Mode */}
      {uploadMode === 'file' && previewFiles.length === 0 && (!multiple || images.length < maxFiles) && (
        <div
          className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors cursor-pointer ${
            isDragging
              ? 'border-black-700 bg-gray-50'
              : 'border-gray-300 hover:border-gray-500'
          }`}
          onClick={handleUploadAreaClick}
          onDragEnter={handleDragEnter}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/jpg,image/png,image/webp,image/gif,image/bmp,image/tiff,image/svg+xml,image/avif"
            multiple={multiple}
            onChange={handleFileSelect}
            className="hidden"
            id={`image-upload-${uniqueId}`}
          />
          <div className="flex flex-col items-center space-y-2 pointer-events-none">
            {images.length === 0 ? (
              <ImageIcon className="w-12 h-12 text-gray-400" />
            ) : (
              <Upload className="w-12 h-12 text-gray-400" />
            )}
            <span className="text-sm text-gray-600">
              {images.length === 0
                ? 'Click or drag & drop to upload images'
                : multiple
                ? `Add more images (${images.length}/${maxFiles})`
                : 'Change image'}
            </span>
            <span className="text-xs text-gray-500">
              All image formats supported (auto-converted to WebP) up to 5MB {multiple && `(max ${maxFiles} files)`}
            </span>
          </div>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
          {error}
        </div>
      )}

      {/* Info */}
      {uploadMode === 'file' && (
        <p className="text-xs text-gray-500">
          {multiple
            ? `You can upload up to ${maxFiles} images. All formats are automatically converted to WebP for optimal performance. Images will be stored securely and served via MinIO.`
            : 'Upload a single product image. All formats are automatically converted to WebP for optimal performance. Image will be stored securely and served via MinIO.'}
        </p>
      )}
      {uploadMode === 'url' && (
        <p className="text-xs text-gray-500">
          {multiple
            ? `You can add up to ${maxFiles} images via URL. Use direct image links from reliable image hosts. Images added via URL are not stored in MinIO.`
            : 'Add a single product image via URL. Use a direct image link from a reliable image host. Images added via URL are not stored in MinIO.'}
        </p>
      )}
    </div>
  )
}
