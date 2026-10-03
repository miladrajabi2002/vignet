/**
 * Product photos from shop domains are served through our origin:
 *   - dashboard/public <img> tags use productImageSrc() so viewers who cannot
 *     reach the shop (VPN exits, geo-blocks) still see the photo;
 *   - Meta template cards get webp re-encoded as JPEG (Meta drops webp).
 */
import sharp from 'sharp'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  safeHttpGet: vi.fn(),
  uploadFile: vi.fn(),
  fileExists: vi.fn(),
}))

vi.mock('@/lib/security/safe-http', () => ({ safeHttpGet: mocks.safeHttpGet }))
vi.mock('@/lib/storage', () => ({
  BUCKETS: { products: 'products' },
  isStorageConfigured: () => true,
  fileExists: mocks.fileExists,
  uploadFile: mocks.uploadFile,
}))

import { productImageSrc } from '@/lib/products/image-src'
import { cacheRemoteImage } from '@/lib/products/remote-image'

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

describe('cacheRemoteImage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.fileExists.mockResolvedValue(false)
    mocks.uploadFile.mockResolvedValue(undefined)
  })

  it('re-encodes webp as JPEG for Meta template cards', async () => {
    const webp = await sharp({
      create: { width: 4, height: 4, channels: 3, background: '#c33' },
    }).webp().toBuffer()
    mocks.safeHttpGet.mockResolvedValue({
      status: 200,
      headers: { 'content-type': 'image/webp' },
      body: webp,
    })

    const cached = await cacheRemoteImage('https://shop.example/a-unique-test.webp', { templateSafe: true })

    expect(cached.filename).toMatch(/^[0-9a-f]{40}\.jpg$/)
    const upload = mocks.uploadFile.mock.calls[0][0]
    expect(upload.contentType).toBe('image/jpeg')
    expect((await sharp(upload.body).metadata()).format).toBe('jpeg')
  })

  it('keeps the original format for browser display', async () => {
    const webp = await sharp({
      create: { width: 4, height: 4, channels: 3, background: '#3c3' },
    }).webp().toBuffer()
    mocks.safeHttpGet.mockResolvedValue({
      status: 200,
      headers: { 'content-type': 'image/webp' },
      body: webp,
    })

    const cached = await cacheRemoteImage('https://shop.example/another-unique-test.webp')

    expect(cached.filename).toMatch(/\.webp$/)
    expect(mocks.uploadFile.mock.calls[0][0].contentType).toBe('image/webp')
  })
})
