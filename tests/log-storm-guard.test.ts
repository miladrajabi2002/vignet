import { beforeEach, describe, expect, it, vi } from 'vitest'

const { create } = vi.hoisted(() => ({ create: vi.fn().mockResolvedValue({}) }))
vi.mock('@/lib/prisma', () => ({ prisma: { errorLog: { create } } }))

import { persistLog, resetLogStormGuard } from '@/lib/errors/capture'

describe('error log storm guard', () => {
  beforeEach(() => {
    create.mockClear()
    resetLogStormGuard()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(console, 'info').mockImplementation(() => {})
  })

  it('stores a burst of identical errors once per 20 and reports what it skipped', async () => {
    vi.useFakeTimers()
    for (let i = 0; i < 25; i++) await persistLog('error', 'sweep', new Error('provider down'))
    expect(create).toHaveBeenCalledTimes(20)

    vi.advanceTimersByTime(5 * 60_000)
    await persistLog('error', 'sweep', new Error('provider down'))
    expect(create).toHaveBeenCalledTimes(21)
    expect(create.mock.calls[20][0].data.metadata).toMatchObject({ skippedRepeats: 5 })
    vi.useRealTimers()
  })

  it('keeps different errors and every info event', async () => {
    for (let i = 0; i < 30; i++) await persistLog('info', 'sms:attempt', 'attempt')
    for (let i = 0; i < 30; i++) await persistLog('error', 'sweep', new Error(`failure ${i}`))
    expect(create).toHaveBeenCalledTimes(60)
  })
})
