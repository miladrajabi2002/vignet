import { beforeEach, describe, expect, it, vi } from 'vitest'

const { updateMany, create } = vi.hoisted(() => ({ updateMany: vi.fn(), create: vi.fn() }))

vi.mock('@/lib/prisma', () => ({
  prisma: { conversationSalesInsight: { updateMany, create } },
}))

import { analyzeSalesConversation, persistConversationSalesInsight } from '@/lib/ai/sales-intelligence'

const context = {
  conversationId: 'c1',
  workspaceId: 'w1',
  businessType: 'COMMERCE' as const,
  language: 'fa',
  roleTemplate: null,
  messageCount: 2,
  messages: [{ role: 'USER' as const, content: 'ممنون' }],
}
const analysis = analyzeSalesConversation({ messages: context.messages })

describe('sales insight persistence before the satisfaction migration', () => {
  beforeEach(() => {
    updateMany.mockReset()
    create.mockReset()
  })

  it('stores satisfaction when the columns exist', async () => {
    updateMany.mockResolvedValue({ count: 1 })
    await persistConversationSalesInsight(context, analysis)
    expect(updateMany).toHaveBeenCalledTimes(1)
    expect(updateMany.mock.calls[0][0].data).toMatchObject({ satisfaction: 80, topics: [], aiTurnCount: 0 })
  })

  it.each([
    ['an older generated client', { name: 'PrismaClientValidationError' }],
    ['a database without the columns', { code: 'P2022' }],
  ])('still saves the snapshot with %s', async (_label, failure) => {
    updateMany.mockRejectedValueOnce(failure).mockResolvedValue({ count: 1 })
    await persistConversationSalesInsight(context, analysis)
    expect(updateMany).toHaveBeenCalledTimes(2)
    const retried = updateMany.mock.calls[1][0].data
    expect(retried).not.toHaveProperty('satisfaction')
    expect(retried).not.toHaveProperty('topics')
    expect(retried).toMatchObject({ sentiment: 'POSITIVE', modelVersion: 'sales-hybrid-v3' })
  })

  it('does not swallow unrelated failures', async () => {
    updateMany.mockRejectedValue({ code: 'P1001' })
    await expect(persistConversationSalesInsight(context, analysis)).rejects.toMatchObject({ code: 'P1001' })
    expect(updateMany).toHaveBeenCalledTimes(1)
  })
})
