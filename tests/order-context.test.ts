import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ findFirst: vi.fn() }))

vi.mock('@/lib/prisma', () => ({
  prisma: { storeOrder: { findFirst: mocks.findFirst } },
}))

import { buildOrderContext } from '@/lib/ai/order-context'

const base = {
  workspaceId: 'workspace-1',
  enabled: true,
  language: 'fa',
}

describe('verified order context', () => {
  beforeEach(() => {
    mocks.findFirst.mockReset().mockResolvedValue({
      externalOrderId: '75242',
      status: 'completed',
      total: 100,
      currency: 'IRR',
      itemCount: 1,
      itemsSummary: '1× محصول',
      trackingCode: '3142920261003142726544',
      courierName: 'tipax',
      shippingDate: null,
      trackingLink: 'https://www.tipax.ir/Tracking?code=3142920261003142726544',
      shippingNote: null,
      shippingMethod: 'پست پیشتاز',
      orderDate: null,
    })
  })

  it('looks up a bare order number when it answers an order-number prompt', async () => {
    const context = await buildOrderContext({
      ...base,
      message: '۷۵۲۴۲',
      history: [
        { role: 'user', content: 'سفارشم کجاست؟' },
        { role: 'assistant', content: 'لطفاً شماره سفارش را بفرستید.' },
      ],
    })

    expect(mocks.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        workspaceId: 'workspace-1',
        externalOrderId: '75242',
      },
    }))
    expect(context).toContain('tracking_code: 3142920261003142726544')
    expect(context).toContain('https://www.tipax.ir/Tracking?code=3142920261003142726544')
    expect(context).toContain('شماره موبایل نخواه')
    expect(context).toContain('همان رشته را کامل و بدون تغییر')
  })

  it('does not treat an unrelated bare number as an order lookup', async () => {
    const context = await buildOrderContext({
      ...base,
      message: '73803',
      history: [{ role: 'assistant', content: 'چه رنگی می‌خواهید؟' }],
    })

    expect(context).toBe('')
    expect(mocks.findFirst).not.toHaveBeenCalled()
  })

  it('looks up an order by number even when the Instagram contact has no phone', async () => {
    const context = await buildOrderContext({
      ...base,
      message: 'کد رهگیری سفارش 75242 رو بده',
    })

    expect(mocks.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { workspaceId: 'workspace-1', externalOrderId: '75242' },
    }))
    expect(context).toContain('tracking_code: 3142920261003142726544')
    expect(context).not.toContain('شماره تلفن ثبت‌شده هنگام خرید را بخواه')
  })

  it('marks a missing tracking code explicitly so the model cannot substitute another number', async () => {
    mocks.findFirst.mockResolvedValueOnce({
      externalOrderId: '75242',
      status: 'completed',
      total: 100,
      currency: 'IRR',
      itemCount: 1,
      itemsSummary: '1× محصول',
      trackingCode: null,
      courierName: null,
      shippingDate: null,
      trackingLink: null,
      shippingNote: null,
      shippingMethod: 'ارسال رایگان',
      orderDate: null,
    })

    const context = await buildOrderContext({ ...base, message: 'کد رهگیری سفارش 75242' })

    expect(context).toContain('tracking_code: NOT_AVAILABLE')
    expect(context).toContain('tracking_link: NOT_AVAILABLE')
    expect(context).toContain('هیچ کدی نساز')
  })

  it('does not ask for a phone when an order number is unknown', async () => {
    mocks.findFirst.mockResolvedValueOnce(null)

    const context = await buildOrderContext({ ...base, message: 'پیگیری سفارش 99999' })

    expect(context).toContain('شماره سفارش را دوباره بررسی کند')
    expect(context).toContain('شماره موبایل نخواه')
  })
})
