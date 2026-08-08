import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  conversationFindFirst: vi.fn(),
  conversationUpdate: vi.fn(),
  messageFindFirst: vi.fn(),
  messageCreate: vi.fn(),
  agentChannelFindFirst: vi.fn(),
  sendText: vi.fn(),
  captureError: vi.fn(),
  bumpContactActivity: vi.fn(),
  recordConversationActivity: vi.fn(),
  evaluateLearningEligibility: vi.fn(),
}))

vi.mock('@/lib/session', () => ({ getCurrentUser: mocks.getCurrentUser }))
vi.mock('@/lib/prisma', () => ({
  prisma: {
    conversation: {
      findFirst: mocks.conversationFindFirst,
      update: mocks.conversationUpdate,
    },
    message: {
      findFirst: mocks.messageFindFirst,
      create: mocks.messageCreate,
    },
    agentChannel: { findFirst: mocks.agentChannelFindFirst },
  },
}))
vi.mock('@/lib/channels/config', () => ({ readBotToken: () => 'token' }))
vi.mock('@/lib/instagram/config', () => ({ readPageToken: () => 'token' }))
vi.mock('@/lib/channels/registry', () => ({
  isMessengerType: (channel: string) => ['TELEGRAM', 'BALE', 'RUBIKA', 'INSTAGRAM'].includes(channel),
  getAdapter: () => ({ sendText: mocks.sendText }),
}))
vi.mock('@/lib/errors/capture', () => ({ captureError: mocks.captureError }))
vi.mock('@/lib/crm/contact-activity', () => ({ bumpContactActivity: mocks.bumpContactActivity }))
vi.mock('@/lib/conversations/activity', () => ({ recordConversationActivity: mocks.recordConversationActivity }))
vi.mock('@/lib/ai/learning-policy', () => ({ evaluateLearningEligibility: mocks.evaluateLearningEligibility }))

import { POST } from '@/app/api/conversations/[conversationId]/reply/route'

const props = { params: Promise.resolve({ conversationId: 'conversation-1' }) }
const createdAt = new Date('2026-08-04T10:00:00.000Z')

function request() {
  return new Request('https://vigent.test/api/conversations/conversation-1/reply', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: ' پاسخ اپراتور ' }),
  })
}

function conversation(channel: 'CHAT_LINK' | 'TELEGRAM' | 'WHATSAPP', externalId: string | null) {
  return {
    id: 'conversation-1',
    agentId: 'agent-1',
    channel,
    externalId,
    contact: { phone: channel === 'WHATSAPP' ? '+989128352271' : null },
  }
}

describe('POST /api/conversations/:id/reply delivery outcome', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getCurrentUser.mockResolvedValue({ id: 'user-1', workspaceId: 'workspace-1' })
    mocks.conversationFindFirst.mockResolvedValue(conversation('CHAT_LINK', 'visitor-1'))
    mocks.messageFindFirst.mockResolvedValue(null)
    mocks.messageCreate.mockResolvedValue({
      id: 'message-1',
      content: 'پاسخ اپراتور',
      createdAt,
      role: 'ASSISTANT',
    })
    mocks.conversationUpdate.mockResolvedValue({ id: 'conversation-1' })
    mocks.agentChannelFindFirst.mockResolvedValue({ config: {} })
    mocks.sendText.mockResolvedValue(undefined)
    mocks.recordConversationActivity.mockResolvedValue(undefined)
  })

  it('reports chat-link history delivery as successful instead of unavailable', async () => {
    const response = await POST(request(), props)

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual(expect.objectContaining({
      delivered: true,
      delivery: { status: 'stored', reason: 'history_delivery' },
    }))
    expect(mocks.agentChannelFindFirst).not.toHaveBeenCalled()
    expect(mocks.sendText).not.toHaveBeenCalled()
    expect(mocks.messageCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        metadata: {
          operator: true,
          delivery: { status: 'stored', reason: 'history_delivery' },
        },
      }),
    }))
  })

  it('reports a messenger reply sent only after the shared adapter succeeds', async () => {
    mocks.conversationFindFirst.mockResolvedValue(conversation('TELEGRAM', 'chat-1'))

    const response = await POST(request(), props)

    expect(await response.json()).toEqual(expect.objectContaining({
      delivered: true,
      delivery: { status: 'sent' },
    }))
    expect(mocks.sendText).toHaveBeenCalledWith('chat-1', 'پاسخ اپراتور')
    expect(mocks.messageCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        metadata: {
          operator: true,
          delivery: { status: 'sent', reason: null },
        },
      }),
    }))
  })

  it('keeps the message but reports a real provider failure truthfully', async () => {
    const providerError = new Error('provider down')
    mocks.conversationFindFirst.mockResolvedValue(conversation('TELEGRAM', 'chat-1'))
    mocks.sendText.mockRejectedValue(providerError)

    const response = await POST(request(), props)

    expect(await response.json()).toEqual(expect.objectContaining({
      delivered: false,
      delivery: { status: 'failed', reason: 'provider_error' },
    }))
    expect(mocks.captureError).toHaveBeenCalledWith(
      'conversation:operator-reply',
      providerError,
      expect.any(Object),
    )
    expect(mocks.messageCreate).toHaveBeenCalledOnce()
  })

  it('keeps a historical WhatsApp reply in the inbox without claiming delivery', async () => {
    mocks.conversationFindFirst.mockResolvedValue(conversation('WHATSAPP', null))

    const response = await POST(request(), props)

    expect((await response.json()).delivery).toEqual({ status: 'unavailable', reason: 'channel_retired' })
    expect(mocks.sendText).not.toHaveBeenCalled()
  })
})
