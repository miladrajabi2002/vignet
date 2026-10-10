import { describe, expect, it, vi } from 'vitest'

/**
 * Follow-gate confirm matching must survive how Persians actually type:
 * Arabic vs Persian yeh/kaf, emoji, punctuation, extra words and spacing.
 * The old exact `===` match silently ignored every variant, so the gate
 * looked dead even though the customer tapped/typed the confirm phrase.
 */

vi.mock('@/lib/prisma', () => ({
  prisma: {
    instagramFollowGate: {
      findMany: vi.fn().mockResolvedValue([{
        id: 'gate-1',
        payload: {
          gateMode: 'SOFT',
          gateConfirmKeyword: 'فالو کردم',
        },
      }]),
    },
    instagramAutomation: { findMany: vi.fn().mockResolvedValue([]) },
  },
}))

vi.mock('@/lib/errors/capture', () => ({
  captureError: vi.fn(),
  captureWarning: vi.fn(),
}))

import { willInstagramAutomationHandle } from '@/lib/instagram/automation'

function dm(text: string) {
  return {
    agentId: 'agent-1',
    channelId: 'channel-1',
    msg: {
      kind: 'DM' as const,
      chatId: 'user-1',
      senderId: 'user-1',
      text,
    },
  }
}

describe('follow-gate confirm matching (fuzzy Persian)', () => {
  it('matches the exact keyword', async () => {
    expect(await willInstagramAutomationHandle(dm('فالو کردم'))).toBe(true)
  })

  it('matches Arabic kaf/yeh variants of the keyword', async () => {
    // «ك» Arabic kaf + «ی» Persian yeh mix — typed on an Arabic keyboard
    expect(await willInstagramAutomationHandle(dm('فالو كردم'))).toBe(true)
  })

  it('matches keyword with emoji and punctuation noise', async () => {
    expect(await willInstagramAutomationHandle(dm('فالو کردم 🌹'))).toBe(true)
    expect(await willInstagramAutomationHandle(dm('فالو کردم!'))).toBe(true)
  })

  it('matches keyword inside a short casual sentence', async () => {
    expect(await willInstagramAutomationHandle(dm('داداش فالو کردم بفرست'))).toBe(true)
  })

  it('matches known synonyms', async () => {
    expect(await willInstagramAutomationHandle(dm('دنبال کردم'))).toBe(true)
    expect(await willInstagramAutomationHandle(dm('فالو شدم'))).toBe(true)
  })

  it('never matches unrelated text', async () => {
    expect(await willInstagramAutomationHandle(dm('سلام خوبی'))).toBe(false)
    expect(await willInstagramAutomationHandle(dm('قیمت چنده؟'))).toBe(false)
  })
})
