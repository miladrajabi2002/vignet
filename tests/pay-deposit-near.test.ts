import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/prisma', () => ({ prisma: {} }))

const { depositGapLabel, depositNear } = await import('@/lib/payments/card/ingest')
const { parseBankSms } = await import('@/lib/payments/card/sms-parse')

describe('deposits that equal no payment exactly', () => {
  it('stay with the owner only when close to what was due', () => {
    // Rounded up, a little short, part of it.
    expect(depositNear(1_250_000, 1_234_567)).toBe(true)
    expect(depositNear(1_200_000, 1_234_567)).toBe(true)
    expect(depositNear(1_000_000, 1_234_567)).toBe(true)
    // Small amounts get 5,000 tomans of room.
    expect(depositNear(20_000, 16_000)).toBe(true)
    // Nowhere near: a salary, a friend's transfer.
    expect(depositNear(440_039, 5_900_000)).toBe(false)
    expect(depositNear(5_000_000, 1_234_567)).toBe(false)
    expect(depositNear(0, 100_000)).toBe(false)
  })

  it('says how the deposit differs', () => {
    expect(depositGapLabel(1_200_000, 1_234_567, 'en')).toBe('34,567 Toman less')
    expect(depositGapLabel(1_250_000, 1_234_567, 'en')).toBe('15,433 Toman more')
  })
})

describe('escaped line breaks', () => {
  it('reads a literal «\\n» from forwarder apps as a line break', () => {
    const parsed = parseBankSms('انتقال\\nاینترنت:+4,400,395\\nحساب:152601422685\\nمانده:12,345,678\\n0725-10:32')
    expect(parsed.kind).toBe('deposit')
    expect(parsed.amountRial).toBe(4_400_395)
    expect(parsed.redacted).not.toContain('\\n')
    expect(parsed.redacted.split('\n').length).toBeGreaterThan(3)
  })
})
