import { afterEach, describe, expect, it } from 'vitest'
import { templateImageUrl } from '@/lib/instagram/media'

const originalPublicUrl = process.env.S3_PUBLIC_URL

afterEach(() => {
  if (originalPublicUrl === undefined) delete process.env.S3_PUBLIC_URL
  else process.env.S3_PUBLIC_URL = originalPublicUrl
})

describe('Instagram product media URLs', () => {
  it('moves legacy own-origin API uploads onto the crawler-facing media route', async () => {
    process.env.S3_PUBLIC_URL = 'https://vigent.ir'

    await expect(
      templateImageUrl(
        'https://vigent.ir/api/uploads/products/workspace-1/2026/09/product.png',
      ),
    ).resolves.toBe(
      'https://vigent.ir/media/products/workspace-1/2026/09/product.png',
    )
  })

  it('keeps an already-public product media URL stable', async () => {
    process.env.S3_PUBLIC_URL = 'https://vigent.ir'

    await expect(
      templateImageUrl('https://vigent.ir/media/products/proxy/image.jpg'),
    ).resolves.toBe('https://vigent.ir/media/products/proxy/image.jpg')
  })
})
