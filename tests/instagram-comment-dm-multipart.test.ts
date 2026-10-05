/**
 * Regression: comment→DM multi-part replies must deliver EVERY part
 * immediately — no «ادامه» continue button, no parked gate rows.
 *
 * The first part claims the ONE private reply each comment allows; the
 * remaining parts go to the commenter's IGSID as best-effort DMs (a failed
 * part is captured and must never block the rest).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  followGateFindFirst: vi.fn(),
  followGateCreate: vi.fn(),
  automationFindMany: vi.fn(),
  sendText: vi.fn(),
  sendRichEntry: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    instagramFollowGate: {
      findFirst: mocks.followGateFindFirst,
      create: mocks.followGateCreate,
    },
    instagramAutomation: { findMany: mocks.automationFindMany },
  },
}))

vi.mock('@/lib/ai/chat-engine', () => ({ generateReply: vi.fn() }))
vi.mock('@/lib/errors/capture', () => ({ captureError: vi.fn(), captureWarning: vi.fn() }))
vi.mock('@/lib/instagram/media', () => ({
  sendImage: vi.fn(),
  sendAudio: vi.fn(),
  sendVideo: vi.fn(),
  sendProductCard: vi.fn(),
  sendRichEntry: mocks.sendRichEntry,
  sendButtonMessage: vi.fn(),
  pickTemplateImageUrl: vi.fn(() => null),
}))
vi.mock('@/lib/instagram/config', () => ({
  readAutomationPolicy: vi.fn(() => null),
  readUserToken: vi.fn(() => 'token'),
  readPageToken: vi.fn(() => 'token'),
}))

import { runInstagramAutomation } from '@/lib/instagram/automation'
import type { InboundMessage, MessengerAdapter } from '@/lib/channels/types'

const priceText = 'سلام دوست عزیز\nقیمت 2499 ت'
const productEntry = { type: 'PRODUCT_LIST', productIds: ['prod-1'] }

function scenario(messages: unknown[]) {
  return {
    id: 'auto-1',
    agentId: 'agent-1',
    channelId: 'ig-channel-1',
    type: 'COMMENT',
    name: 'بلوزشلوار',
    active: true,
    priority: 0,
    trigger: { keywords: ['الو'], matchMode: 'CONTAINS', storyScope: 'KEYWORD', postIds: [] },
    action: { replyMode: 'STATIC', dmOnComment: true, replyText: priceText, messages },
  }
}

function ctx(msg: InboundMessage) {
  return {
    agent: { id: 'agent-1', workspaceId: 'workspace-1' } as never,
    channelId: 'ig-channel-1',
    channelConfig: { accessToken: 'token' },
    adapter: { sendText: mocks.sendText } as unknown as MessengerAdapter,
    msg,
    contactId: 'contact-1',
    contactName: 'Customer',
    quickReplies: [],
  }
}

const comment: InboundMessage = {
  kind: 'COMMENT',
  platformMessageId: 'c-1',
  senderId: 'igsid-1',
  senderName: 'Customer',
  text: 'الو',
  chatId: 'comment:c-1',
  commentId: 'c-1',
  postId: 'post-1',
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.followGateFindFirst.mockResolvedValue(null)
  mocks.followGateCreate.mockResolvedValue({})
  mocks.sendText.mockResolvedValue(undefined)
  mocks.sendRichEntry.mockResolvedValue(undefined)
})

describe('comment→DM sequence over a private reply', () => {
  it('delivers every part immediately — no continue button, no parked gate', async () => {
    mocks.automationFindMany.mockResolvedValue([
      scenario([{ type: 'TEXT', text: priceText }, productEntry]),
    ])

    const result = await runInstagramAutomation(ctx(comment))

    expect(result.handled).toBe(true)
    // The first part claims the private reply...
    expect(mocks.sendRichEntry.mock.calls[0][1]).toMatch(/^private:c-1/)
    // ...and the rest goes straight to the commenter's IGSID.
    expect(mocks.sendRichEntry.mock.calls[1][1]).toBe('igsid-1')
    expect(mocks.sendRichEntry.mock.calls[1][2]).toMatchObject(productEntry)
    // No button message and no parked CONTINUE gate.
    expect(mocks.followGateCreate).not.toHaveBeenCalled()
  })

  it('keeps a single text reply as one plain private reply', async () => {
    mocks.automationFindMany.mockResolvedValue([scenario([{ type: 'TEXT', text: priceText }])])

    await runInstagramAutomation(ctx(comment))

    expect(mocks.sendRichEntry).toHaveBeenCalledTimes(1)
    expect(mocks.sendRichEntry.mock.calls[0][1]).toMatch(/^private:c-1/)
    expect(mocks.followGateCreate).not.toHaveBeenCalled()
  })

  it('still delivers later parts when one of them fails', async () => {
    mocks.automationFindMany.mockResolvedValue([
      scenario([
        { type: 'TEXT', text: priceText },
        { type: 'IMAGE', mediaUrl: 'https://example.com/a.jpg' },
        productEntry,
      ]),
    ])
    mocks.sendRichEntry
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('no open thread'))
      .mockResolvedValueOnce(undefined)

    await runInstagramAutomation(ctx(comment))

    expect(mocks.sendRichEntry).toHaveBeenCalledTimes(3)
    expect(mocks.sendRichEntry.mock.calls[2][1]).toBe('igsid-1')
    expect(mocks.sendRichEntry.mock.calls[2][2]).toMatchObject(productEntry)
  })
})
