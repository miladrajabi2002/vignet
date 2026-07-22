import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  workspaceFindUnique: vi.fn(),
  subscriptionFindUnique: vi.fn(),
  agentChannelFindUnique: vi.fn(),
  agentChannelCount: vi.fn(),
  chatLinkFindUnique: vi.fn(),
  chatLinkCount: vi.fn(),
  getEffectivePlanDefs: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    workspace: { findUnique: mocks.workspaceFindUnique },
    subscription: { findUnique: mocks.subscriptionFindUnique },
    agentChannel: {
      findUnique: mocks.agentChannelFindUnique,
      count: mocks.agentChannelCount,
    },
    chatLink: {
      findUnique: mocks.chatLinkFindUnique,
      count: mocks.chatLinkCount,
    },
  },
}))

vi.mock('@/lib/billing/plans', () => ({
  PERIOD_DAYS: 30,
  getEffectivePlanDefs: mocks.getEffectivePlanDefs,
}))

vi.mock('@/lib/redis', () => ({
  getRedis: vi.fn(),
}))

vi.mock('@/lib/sms/ippanel', () => ({
  sendSubscriptionPurchasedSms: vi.fn(),
}))

vi.mock('@/lib/errors/capture', () => ({
  captureError: vi.fn(),
}))

vi.mock('@/lib/billing/plan-credit', () => ({
  grantIncludedPlanCredit: vi.fn(),
}))

import { checkChannelConnectAllowed } from '@/lib/billing/entitlements'

beforeEach(() => {
  vi.clearAllMocks()
  mocks.workspaceFindUnique.mockResolvedValue({
    plan: 'TRIAL',
    trialEndsAt: new Date(Date.now() + 86_400_000),
  })
  mocks.agentChannelFindUnique.mockResolvedValue(null)
  mocks.chatLinkFindUnique.mockResolvedValue(null)
  mocks.agentChannelCount.mockResolvedValue(0)
  mocks.chatLinkCount.mockResolvedValue(0)
  mocks.getEffectivePlanDefs.mockResolvedValue({
    TRIAL: { maxChannels: 2 },
  })
})

describe('channel-based plan entitlements', () => {
  it('allows a new channel while the combined workspace allowance has room', async () => {
    mocks.agentChannelCount.mockResolvedValue(1)

    await expect(checkChannelConnectAllowed('ws-1', {
      kind: 'AGENT_CHANNEL',
      agentId: 'agent-1',
      type: 'TELEGRAM',
    })).resolves.toEqual({ allowed: true, plan: 'TRIAL' })
  })

  it('counts enabled chat links and active agent channels together', async () => {
    mocks.agentChannelCount.mockResolvedValue(1)
    mocks.chatLinkCount.mockResolvedValue(1)

    await expect(checkChannelConnectAllowed('ws-1', {
      kind: 'AGENT_CHANNEL',
      agentId: 'agent-1',
      type: 'WHATSAPP',
    })).resolves.toEqual({ allowed: false, reason: 'CHANNEL_LIMIT' })
  })

  it('allows reconfiguring an existing active connection even at the limit', async () => {
    mocks.agentChannelFindUnique.mockResolvedValue({ active: true })

    await expect(checkChannelConnectAllowed('ws-1', {
      kind: 'AGENT_CHANNEL',
      agentId: 'agent-1',
      type: 'INSTAGRAM',
    })).resolves.toEqual({ allowed: true, plan: 'TRIAL' })
    expect(mocks.agentChannelCount).not.toHaveBeenCalled()
    expect(mocks.chatLinkCount).not.toHaveBeenCalled()
  })

  it('does not consume another slot when updating an enabled chat link', async () => {
    mocks.chatLinkFindUnique.mockResolvedValue({ enabled: true })

    await expect(checkChannelConnectAllowed('ws-1', {
      kind: 'CHAT_LINK',
      agentId: 'agent-1',
    })).resolves.toEqual({ allowed: true, plan: 'TRIAL' })
    expect(mocks.agentChannelCount).not.toHaveBeenCalled()
  })
})
