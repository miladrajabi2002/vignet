import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { PayPageClient } from '@/app/(app)/pay/[authority]/pay-client'
import type { CardPayStatus, CardPayView } from '@/lib/payments/card/pay-card'

const now = Date.now()

function page(status: CardPayStatus, expiresAt: number): string {
  const card: CardPayView = {
    code: 'L-L435YC',
    authority: 'PwEFp8ETb3mcNPimgvJfGYg4l',
    url: 'https://vigent.test/pay/PwEFp8ETb3mcNPimgvJfGYg4l',
    bankKey: 'maskan',
    pan: '6280231561955880',
    holder: 'میلاد رجبی',
    amount: 2_372_312,
    expiresAt: new Date(expiresAt).toISOString(),
    claim: true,
    status,
    lang: 'fa',
  }
  return renderToString(createElement(PayPageClient, {
    card,
    business: 'ویجنت',
    website: 'vigent.ir',
    description: null,
    baseAmount: 2_372_000,
    items: [{ name: 'کرم آبرسان', quantity: 2, unitPrice: 385_000 }],
    paidAt: null,
    createdAt: new Date(expiresAt - 20 * 60_000).toISOString(),
    hasReturn: false,
  }))
}

describe('hosted pay page states', () => {
  it('waits with the copy buttons and the timer', () => {
    const html = page('PENDING', now + 10 * 60_000)
    expect(html).toContain('data-phase="wait"')
    expect(html).toContain('کپی شماره کارت')
  })

  it('opens expired with «I have paid» while the amount is still held', () => {
    const html = page('EXPIRED', now - 60_000)
    expect(html).toContain('data-phase="closed"')
    expect(html).toContain('مهلت پرداخت تمام شد')
    expect(html).toContain('واریز کرده‌ام')
    expect(html).not.toContain('کپی شماره کارت')
  })

  it('drops «I have paid» once the hold has run out', () => {
    const html = page('EXPIRED', now - 3 * 60 * 60_000)
    expect(html).toContain('مهلت پرداخت تمام شد')
    expect(html).not.toContain('واریز کرده‌ام')
  })

  it('keeps the expired page for a claim made after the deadline', () => {
    const html = page('CLAIMED', now - 60_000)
    expect(html).toContain('data-phase="closed"')
    expect(html).toContain('خبر دادیم')
  })

  it('says no transfer was found for a rejected payment, with no claim', () => {
    const html = page('FAILED', now - 60_000)
    expect(html).toContain('واریزی پیدا نشد')
    expect(html).not.toContain('واریز کرده‌ام')
  })
})
