/**
 * Product photos from shop domains:
 *   - <ProductImage> loads the shop URL first and falls back to
 *     productImageSrc() → /media/products/remote, which keeps a small webp
 *     thumbnail per workspace within a byte quota (oldest evicted first);
 *   - Meta template cards get webp re-encoded as JPEG (Meta drops webp).
 */
import sharp from 'sharp'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  safeHttpGet: vi.fn(),
  uploadFile: vi.fn(),
  fileExists: vi.fn(),
  listFiles: vi.fn(),
  deleteFile: vi.fn(),
}))

vi.mock('@/lib/security/safe-http', () => ({ safeHttpGet: mocks.safeHttpGet }))
vi.mock('@/lib/prisma', () => ({ prisma: {} }))
vi.mock('@/lib/storage', () => ({
  BUCKETS: { products: 'products' },
  isStorageConfigured: () => true,
  fileExists: mocks.fileExists,
  uploadFile: mocks.uploadFile,
  listFiles: mocks.listFiles,
  deleteFile: mocks.deleteFile,
}))

import { productImageSrc } from '@/lib/products/image-src'
import {
  cacheRemoteImage,
  cacheWorkspaceThumbnail,
  thumbnailKey,
  warmWorkspaceThumbnails,
} from '@/lib/products/remote-image'

async function photo(format: 'webp' | 'jpeg', size = 1200) {
  const img = sharp({ create: { width: size, height: size, channels: 3, background: '#c33' } })
  return format === 'webp' ? img.webp().toBuffer() : img.jpeg().toBuffer()
}

function shopReturns(body: Buffer, type: string) {
  mocks.safeHttpGet.mockResolvedValue({ status: 200, headers: { 'content-type': type }, body })
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.fileExists.mockResolvedValue(false)
  mocks.uploadFile.mockResolvedValue(undefined)
  mocks.deleteFile.mockResolvedValue(undefined)
  mocks.listFiles.mockResolvedValue([])
  delete process.env.PRODUCT_IMAGE_CACHE_QUOTA_BYTES
})

describe('productImageSrc', () => {
  it('routes shop-hosted photos through the remote media route', () => {
    const url = 'https://ceeports.ir/wp-content/uploads/2026/09/کت-600x600.webp'
    expect(productImageSrc(url)).toBe(`/media/products/remote?u=${encodeURIComponent(url)}`)
  })

  it('leaves own uploads, relative and inline URLs untouched', () => {
    process.env.NEXT_PUBLIC_APP_URL = 'https://vigent.ir'
    expect(productImageSrc('https://vigent.ir/media/products/w/1.jpg')).toBe('https://vigent.ir/media/products/w/1.jpg')
    expect(productImageSrc('/media/products/w/1.jpg')).toBe('/media/products/w/1.jpg')
    expect(productImageSrc('data:image/png;base64,AA')).toBe('data:image/png;base64,AA')
    expect(productImageSrc(null)).toBeUndefined()
  })
})

describe('cacheRemoteImage (Meta template cards)', () => {
  it('re-encodes webp as JPEG', async () => {
    shopReturns(await photo('webp', 4), 'image/webp')

    const cached = await cacheRemoteImage('https://shop.example/a-unique-test.webp', { templateSafe: true })

    expect(cached.filename).toMatch(/^[0-9a-f]{40}\.jpg$/)
    const upload = mocks.uploadFile.mock.calls[0][0]
    expect(upload.contentType).toBe('image/jpeg')
    expect((await sharp(upload.body).metadata()).format).toBe('jpeg')
  })
})

describe('workspace thumbnails', () => {
  it('stores a shrunken webp under the workspace prefix', async () => {
    shopReturns(await photo('jpeg'), 'image/jpeg')

    const key = await cacheWorkspaceThumbnail('https://shop.example/big.jpg', 'ws1')

    expect(key).toBe(thumbnailKey('https://shop.example/big.jpg', 'ws1'))
    expect(key).toMatch(/^thumbs\/ws1\/[0-9a-f]{40}\.webp$/)
    const upload = mocks.uploadFile.mock.calls[0][0]
    const meta = await sharp(upload.body).metadata()
    expect(meta.format).toBe('webp')
    expect(Math.max(meta.width ?? 0, meta.height ?? 0)).toBeLessThanOrEqual(480)
  })

  it('evicts the oldest thumbnails to stay within the quota', async () => {
    process.env.PRODUCT_IMAGE_CACHE_QUOTA_BYTES = '1000'
    shopReturns(await photo('jpeg', 10), 'image/jpeg')
    mocks.listFiles.mockResolvedValue([
      { key: 'thumbs/ws1/newer.webp', size: 400, lastModified: new Date(2026, 9, 2) },
      { key: 'thumbs/ws1/oldest.webp', size: 590, lastModified: new Date(2026, 0, 1) },
    ])

    await cacheWorkspaceThumbnail('https://shop.example/x.jpg', 'ws1', { evict: true })

    expect(mocks.deleteFile).toHaveBeenCalledWith('products', 'thumbs/ws1/oldest.webp')
    expect(mocks.deleteFile).not.toHaveBeenCalledWith('products', 'thumbs/ws1/newer.webp')
    expect(mocks.uploadFile).toHaveBeenCalledTimes(1)
  })

  it('warm-up stops at the quota instead of evicting', async () => {
    process.env.PRODUCT_IMAGE_CACHE_QUOTA_BYTES = '1'
    shopReturns(await photo('jpeg', 10), 'image/jpeg')

    const result = await warmWorkspaceThumbnails('ws1', ['https://shop.example/1.jpg', 'https://shop.example/2.jpg'])

    expect(result.cached).toBe(0)
    expect(mocks.deleteFile).not.toHaveBeenCalled()
    expect(mocks.uploadFile).not.toHaveBeenCalled()
  })

  it('warm-up skips covers that are already cached', async () => {
    shopReturns(await photo('jpeg', 10), 'image/jpeg')
    const cachedUrl = 'https://shop.example/cached.jpg'
    mocks.listFiles.mockResolvedValue([
      { key: thumbnailKey(cachedUrl, 'ws1'), size: 100, lastModified: new Date() },
    ])

    const result = await warmWorkspaceThumbnails('ws1', [cachedUrl, 'https://shop.example/new.jpg'])

    expect(result).toEqual({ cached: 1, skipped: 1, failed: 0 })
    expect(mocks.safeHttpGet).toHaveBeenCalledTimes(1)
  })
})
