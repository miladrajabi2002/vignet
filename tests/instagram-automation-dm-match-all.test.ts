/**
 * Regression test for the Instagram DM "match-all when keywords empty" behavior.
 *
 * Bug: the form's "هر کلمه‌ای" (ANY) option for DM scenarios sends
 * `trigger.keywords = []` to the API. Before the fix, the engine's
 * `matchKeywords()` returned false for empty keywords, so DM scenarios
 * saved with ANY never matched any message — the scenario was effectively
 * dead.
 *
 * Fix: in `runInstagramAutomation`, for DIRECT_MESSAGE scenarios, treat
 * empty keywords as "match all" (matching the form's helper text:
 * "خالی = همه پیام‌ها"). When keywords are present, apply normal matching.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => {
  return {
    followGateFindFirst: vi.fn(),
    automationFindMany: vi.fn(),
    sendText: vi.fn(),
    sendImage: vi.fn(),
    sendAudio: vi.fn(),
    sendVideo: vi.fn(),
    sendProductCard: vi.fn(),
    sendRichEntry: vi.fn(),
    sendButtonMessage: vi.fn(),
    updateConversation: vi.fn(),
  }
})

vi.mock('@/lib/prisma', () => ({
  prisma: {
    instagramFollowGate: { findFirst: mocks.followGateFindFirst },
    instagramAutomation: { findMany: mocks.automationFindMany },
    conversation: { update: mocks.updateConversation },
  },
}))

vi.mock('@/lib/ai/chat-engine', () => ({ generateReply: vi.fn() }))
vi.mock('@/lib/errors/capture', () => ({ captureError: vi.fn() }))
vi.mock('@/lib/instagram/media', () => ({
  sendImage: mocks.sendImage,
  sendAudio: mocks.sendAudio,
  sendVideo: mocks.sendVideo,
  sendProductCard: mocks.sendProductCard,
  sendRichEntry: mocks.sendRichEntry,
  sendButtonMessage: mocks.sendButtonMessage,
}))
vi.mock('@/lib/instagram/config', () => ({
  readAutomationPolicy: vi.fn(() => null),
  readUserToken: vi.fn(() => 'token'),
  readPageToken: vi.fn(() => 'token'),
}))

import {
  runInstagramAutomation,
  willInstagramAutomationHandle,
} from '@/lib/instagram/automation'
import type { InboundMessage, MessengerAdapter } from '@/lib/channels/types'

function makeDmMessage(text: string): InboundMessage {
  return {
    kind: 'DM',
    platformMessageId: 'mid.1',
    senderId: 'sender-1',
    senderName: 'Sender',
    text,
    chatId: 'chat-1',
  }
}

function makeCtx(msg: InboundMessage) {
  const adapter: MessengerAdapter = {
    sendText: mocks.sendText,
    sendImage: mocks.sendImage,
    sendAudio: mocks.sendAudio,
    sendVideo: mocks.sendVideo,
    sendProductCard: mocks.sendProductCard,
    sendRichEntry: mocks.sendRichEntry,
    sendButtonMessage: mocks.sendButtonMessage,
  } as unknown as MessengerAdapter
  return {
    agent: { id: 'agent-1', workspaceId: 'workspace-1' } as never,
    channelId: 'ig-channel-1',
    adapter,
    msg,
    contactId: 'contact-1',
    contactName: 'Sender',
    quickReplies: [],
  }
}

describe('runInstagramAutomation — DM keyword matching', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // No pending follow-gate by default.
    mocks.followGateFindFirst.mockResolvedValue(null)
    mocks.sendText.mockResolvedValue(undefined)
  })

  it('matches ANY DM scenario (empty keywords) on every message', async () => {
    // ANY scenario: keywords = []
    mocks.automationFindMany.mockResolvedValue([
      {
        id: 'auto-1',
        agentId: 'agent-1',
        channelId: 'ig-channel-1',
        type: 'DIRECT_MESSAGE',
        name: 'welcome',
        active: true,
        priority: 0,
        trigger: { keywords: [], matchMode: 'CONTAINS', storyScope: 'KEYWORD', postIds: [] },
        action: { replyMode: 'STATIC', replyText: 'سلام! خوش آمدی.', messages: [] },
      },
    ])

    const result = await runInstagramAutomation(makeCtx(makeDmMessage('سلام')))
    expect(result.handled).toBe(true)
    expect(result.replied).toBe(true)
    expect(mocks.sendText).toHaveBeenCalledWith(
      'chat-1',
      'سلام! خوش آمدی.',
      expect.anything(),
    )
  })

  it('matches SPECIFIC DM scenario only when a keyword is present', async () => {
    mocks.automationFindMany.mockResolvedValue([
      {
        id: 'auto-1',
        agentId: 'agent-1',
        channelId: 'ig-channel-1',
        type: 'DIRECT_MESSAGE',
        name: 'price',
        active: true,
        priority: 0,
        trigger: {
          keywords: ['قیمت', 'price'],
          matchMode: 'CONTAINS',
          storyScope: 'KEYWORD',
          postIds: [],
        },
        action: { replyMode: 'STATIC', replyText: 'قیمت‌ها در سایت', messages: [] },
      },
    ])

    // Matching message
    const r1 = await runInstagramAutomation(makeCtx(makeDmMessage('قیمت رو می‌خوام')))
    expect(r1.handled).toBe(true)
    expect(mocks.sendText).toHaveBeenCalled()

    // Non-matching message — no scenario fires
    mocks.sendText.mockClear()
    const r2 = await runInstagramAutomation(makeCtx(makeDmMessage('ساعت چنده؟')))
    expect(r2.handled).toBe(false)
    expect(mocks.sendText).not.toHaveBeenCalled()
  })

  it('returns handled=false when there are no scenarios at all', async () => {
    mocks.automationFindMany.mockResolvedValue([])
    const result = await runInstagramAutomation(makeCtx(makeDmMessage('سلام')))
    expect(result.handled).toBe(false)
    expect(result.replied).toBe(false)
  })
})

describe('willInstagramAutomationHandle — read-only routing probe', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.followGateFindFirst.mockResolvedValue(null)
  })

  it('returns false without sending when no active scenario matches', async () => {
    mocks.automationFindMany.mockResolvedValue([{
      id: 'auto-price',
      agentId: 'agent-1',
      channelId: 'ig-channel-1',
      type: 'DIRECT_MESSAGE',
      name: 'price',
      active: true,
      priority: 0,
      trigger: { keywords: ['قیمت'], matchMode: 'EXACT', storyScope: 'KEYWORD', postIds: [] },
      action: { replyMode: 'STATIC', replyText: 'پاسخ قیمت' },
    }])

    const result = await willInstagramAutomationHandle({
      agentId: 'agent-1',
      channelId: 'ig-channel-1',
      msg: makeDmMessage('سلام'),
    })

    expect(result).toBe(false)
    expect(mocks.sendText).not.toHaveBeenCalled()
  })

  it('keeps a pending follow-gate confirmation routable', async () => {
    mocks.followGateFindFirst.mockResolvedValue({
      payload: { gateMode: 'SOFT', gateConfirmKeyword: 'دنبال کردم' },
    })

    const result = await willInstagramAutomationHandle({
      agentId: 'agent-1',
      channelId: 'ig-channel-1',
      msg: makeDmMessage('دنبال کردم'),
    })

    expect(result).toBe(true)
    expect(mocks.automationFindMany).not.toHaveBeenCalled()
  })
})
