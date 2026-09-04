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
      msg: 'اتصال افزونه برقرار است، اما ظرفیت پلن تکمیل شده؛ برای ادامه همگام‌سازی پلن را ارتقا دهید.',
    })
  })
})
