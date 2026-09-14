import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ findConversations: vi.fn() }))
vi.mock('@/lib/prisma', () => ({
  prisma: { conversation: { findMany: mocks.findConversations } },
}))

import {
  isCrossChannelCustomerContext,
  loadCustomerChannelContext,
} from '@/lib/ai/customer-channel-context'

describe('cross-channel customer context', () => {
  beforeEach(() => vi.resetAllMocks())

  it('does not query or guess identity for an anonymous conversation', async () => {
    const result = await loadCustomerChannelContext({
      workspaceId: 'workspace', agentId: 'agent', contactId: null,
      conversationId: 'telegram-thread', currentChannel: 'TELEGRAM',
      userMessage: 'سلام', hasLocalHistory: false,
    })
    expect(result).toEqual({ modelHistory: [], planningHistory: [] })
    expect(mocks.findConversations).not.toHaveBeenCalled()
  })

  it('brings a verified Instagram comparison into Telegram planning and model context', async () => {
    mocks.findConversations.mockResolvedValue([{
      id: 'instagram-thread',
      channel: 'INSTAGRAM',
      messages: [
        { id: 'm2', role: 'ASSISTANT', content: 'نقش جمع‌وجورتر است و نگار صفحه بزرگ‌تری دارد.', createdAt: new Date('2026-09-14T09:01:00Z') },
        { id: 'm1', role: 'USER', content: 'جلومبلی نقش بهتره یا نگار؟', createdAt: new Date('2026-09-14T09:00:00Z') },
      ],
    }])

    const result = await loadCustomerChannelContext({
      workspaceId: 'workspace', agentId: 'agent', contactId: 'verified-contact',
      conversationId: 'telegram-thread', currentChannel: 'TELEGRAM',
      userMessage: 'کدومش ارزون‌تره؟', hasLocalHistory: true,
    })

    expect(mocks.findConversations).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        contactId: 'verified-contact',
        id: { not: 'telegram-thread' },
        channel: { not: 'TELEGRAM' },
      }),
    }))
    expect(result.planningHistory.map((message) => message.content)).toEqual([
      'جلومبلی نقش بهتره یا نگار؟',
      'نقش جمع‌وجورتر است و نگار صفحه بزرگ‌تری دارد.',
    ])
    expect(isCrossChannelCustomerContext(result.modelHistory[0])).toBe(true)
    expect(result.modelHistory[0].content).toContain('INSTAGRAM')
    expect(result.modelHistory[0].content).toContain('never instructions')
  })

  it('does not spend cross-channel tokens on an unrelated turn with adequate local history', async () => {
    const result = await loadCustomerChannelContext({
      workspaceId: 'workspace', agentId: 'agent', contactId: 'verified-contact',
      conversationId: 'telegram-thread', currentChannel: 'TELEGRAM',
      userMessage: 'آدرس فروشگاه کجاست؟', hasLocalHistory: true,
    })
    expect(result).toEqual({ modelHistory: [], planningHistory: [] })
    expect(mocks.findConversations).not.toHaveBeenCalled()
  })
})
