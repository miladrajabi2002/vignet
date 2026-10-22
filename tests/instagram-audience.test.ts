import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/prisma', () => ({ prisma: {} }))

const { audienceBlockMessage, formatFollowers, planFitsAudience, smallestPlanForAudience } = await import('@/lib/billing/instagram-audience')

const page = (followers: number) => ({ followers, username: 'shop' })

describe('plans by Instagram audience', () => {
  it('lets every plan through without a connected page', () => {
    expect(planFitsAudience('STARTER', null)).toBe(true)
    expect(smallestPlanForAudience(null)).toBe('STARTER')
  })

  it('caps Starter at 20K and Pro at 50K, inclusive', () => {
    expect(planFitsAudience('STARTER', page(20_000))).toBe(true)
    expect(planFitsAudience('STARTER', page(20_001))).toBe(false)
    expect(planFitsAudience('PRO', page(50_000))).toBe(true)
    expect(planFitsAudience('PRO', page(50_001))).toBe(false)
    expect(planFitsAudience('BUSINESS', page(5_000_000))).toBe(true)
  })

  it('points a page at the smallest plan that serves it', () => {
    expect(smallestPlanForAudience(page(8_000))).toBe('STARTER')
    expect(smallestPlanForAudience(page(35_000))).toBe('PRO')
    expect(smallestPlanForAudience(page(200_000))).toBe('BUSINESS')
  })

  it('explains the block in Persian', () => {
    expect(formatFollowers(200_000, 'fa')).toBe('۲۰۰ هزار')
    expect(audienceBlockMessage('PRO', page(200_000), 'fa')).toBe('@shop ۲۰۰ هزار فالوور دارد؛ این پلن برای پیج‌های تا ۵۰ هزار فالوور است.')
  })
})
