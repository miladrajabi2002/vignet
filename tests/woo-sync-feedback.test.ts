import { describe, expect, it } from 'vitest'
import { formatWooSyncResult } from '@/components/integrations/format-sync-result'

describe('WooCommerce sync feedback', () => {
  it('identifies a plan limit without blaming the plugin connection', () => {
    const result = formatWooSyncResult({
      products: { count: 0, errors: ['product 51: PRODUCT_LIMIT:50'] },
      orders: { count: 0 },
    })

    expect(result).toEqual({
      type: 'err',
      msg: 'افزونه وصل است، ولی ظرفیت پلن پر شده. برای ادامهٔ همگام‌سازی، پلن را بالاتر ببرید.',
    })
  })

  it('says so when the plugin was asked to resend the whole catalog', () => {
    const result = formatWooSyncResult({
      resyncRequested: true,
      products: { count: 0, errors: [], skipped: true },
      orders: { count: 0, skipped: true },
    })

    expect(result).toEqual({
      type: 'ok',
      msg: 'از افزونه خواسته شد همهٔ محصولات را دوباره بفرستد؛ تا چند دقیقهٔ دیگر کاتالوگ کامل می‌شود.',
    })
  })
})
