import { describe, expect, it, vi } from 'vitest'

const db = vi.hoisted(() => ({
  workspace: { plan: 'STARTER' as string },
  subscription: { status: 'ACTIVE', currentPeriodEnd: new Date(Date.now() + 86_400_000) } as { status: string; currentPeriodEnd: Date } | null,
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    workspace: { findUnique: async () => db.workspace },
    subscription: { findUnique: async () => db.subscription },
  },
}))

const { audienceBlockMessage, connectAudienceBlock, formatFollowers, planFitsAudience, smallestPlanForAudience } = await import('@/lib/billing/instagram-audience')

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

describe('connecting a page', () => {
  const live = () => ({ status: 'ACTIVE', currentPeriodEnd: new Date(Date.now() + 86_400_000) })

  it('refuses a page bigger than the live plan serves', async () => {
    db.workspace = { plan: 'STARTER' }
    db.subscription = live()
    expect(await connectAudienceBlock('w', 20_000)).toBeNull()
    expect(await connectAudienceBlock('w', 35_000)).toEqual({ plan: 'STARTER', cap: 20_000 })
    db.workspace = { plan: 'PRO' }
    expect(await connectAudienceBlock('w', 35_000)).toBeNull()
    expect(await connectAudienceBlock('w', 200_000)).toEqual({ plan: 'PRO', cap: 50_000 })
    db.workspace = { plan: 'BUSINESS' }
    expect(await connectAudienceBlock('w', 5_000_000)).toBeNull()
  })

  it('lets trials, lapsed plans and unknown counts connect (checkout still gates them)', async () => {
    db.workspace = { plan: 'TRIAL' }
    expect(await connectAudienceBlock('w', 200_000)).toBeNull()
    db.workspace = { plan: 'STARTER' }
    db.subscription = { status: 'ACTIVE', currentPeriodEnd: new Date(Date.now() - 1_000) }
    expect(await connectAudienceBlock('w', 200_000)).toBeNull()
    db.subscription = live()
    expect(await connectAudienceBlock('w', undefined)).toBeNull()
  })
})
