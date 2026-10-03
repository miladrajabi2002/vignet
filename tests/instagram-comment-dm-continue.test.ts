/**
 * Regression: comment→DM sequences lost every part after the first.
 *
 * Instagram allows ONE private reply per comment, and nothing else reaches a
 * commenter who has not messaged the account. A scenario of «price text +
 * product card» delivered the text, then the card failed with an empty Meta
 * 500 — the customer never saw the product photo.
 *
 * Fix: the private reply carries the opening text with a «مشاهده محصول»
 * button; the remaining parts are parked as a CONTINUE gate and delivered to
 * the commenter's IGSID when they tap it (no follow check).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  followGateFindFirst: vi.fn(),
  followGateCreate: vi.fn(),
  followGateUpdate: vi.fn(),
  automationFindMany: vi.fn(),
  sendText: vi.fn(),
  sendRichEntry: vi.fn(),
  sendButtonMessage: vi.fn(),
  checkFollow: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    instagramFollowGate: {
      findFirst: mocks.followGateFindFirst,
      create: mocks.followGateCreate,
      update: mocks.followGateUpdate,
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
  sendButtonMessage: mocks.sendButtonMessage,
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
  mocks.sendButtonMessage.mockResolvedValue(undefined)
  mocks.sendText.mockResolvedValue(undefined)
  mocks.sendRichEntry.mockResolvedValue(undefined)
})

describe('comment→DM sequence over a private reply', () => {
  it('sends the opening text with a button and parks the product card', async () => {
    mocks.automationFindMany.mockResolvedValue([
      scenario([{ type: 'TEXT', text: priceText }, productEntry]),
    ])

    const result = await runInstagramAutomation(ctx(comment))

    expect(result.handled).toBe(true)
    expect(mocks.sendButtonMessage).toHaveBeenCalledTimes(1)
    const [, target, text, buttons] = mocks.sendButtonMessage.mock.calls[0]
    expect(target).toMatch(/^private:c-1/)
    expect(text).toBe(priceText)
    expect(buttons).toEqual([{ title: 'مشاهده محصول' }])
    // The product card is NOT sent through the (already used) private reply.
    expect(mocks.sendRichEntry).not.toHaveBeenCalled()

    expect(mocks.followGateCreate).toHaveBeenCalledTimes(1)
    const data = mocks.followGateCreate.mock.calls[0][0].data
    expect(data.chatId).toBe('igsid-1')
    expect(data.payload.gateMode).toBe('CONTINUE')
    expect(data.payload.gateConfirmKeyword).toBe('مشاهده محصول')
    expect(data.payload.contentMessages).toEqual([productEntry])
  })

  it('keeps a single text reply as one plain private reply', async () => {
    mocks.automationFindMany.mockResolvedValue([scenario([{ type: 'TEXT', text: priceText }])])

    await runInstagramAutomation(ctx(comment))

    expect(mocks.sendButtonMessage).not.toHaveBeenCalled()
    expect(mocks.followGateCreate).not.toHaveBeenCalled()
    expect(mocks.sendRichEntry).toHaveBeenCalledTimes(1)
    expect(mocks.sendRichEntry.mock.calls[0][1]).toMatch(/^private:c-1/)
  })

  it('delivers the parked parts to the IGSID when the button is tapped, without a follow check', async () => {
    mocks.followGateFindFirst.mockResolvedValue({
      id: 'gate-1',
      chatId: 'igsid-1',
      automationId: 'auto-1',
      payload: {
        gateMode: 'CONTINUE',
        gateConfirmKeyword: 'مشاهده محصول',
        contentMessages: [productEntry],
      },
    })
    mocks.automationFindMany.mockResolvedValue([])
    const fetchSpy = vi.spyOn(globalThis, 'fetch')

    const result = await runInstagramAutomation(
      ctx({
        kind: 'DM',
        platformMessageId: 'mid-2',
        senderId: 'igsid-1',
        senderName: 'Customer',
        text: 'مشاهده محصول',
        chatId: 'igsid-1',
      }),
    )

    expect(result.handled).toBe(true)
    expect(fetchSpy).not.toHaveBeenCalled() // no follow-status Graph call
    expect(mocks.followGateUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'gate-1' }, data: expect.objectContaining({ status: 'FULFILLED' }) }),
    )
    expect(mocks.sendRichEntry).toHaveBeenCalledTimes(1)
    expect(mocks.sendRichEntry.mock.calls[0][1]).toBe('igsid-1')
    expect(mocks.sendRichEntry.mock.calls[0][2]).toMatchObject(productEntry)
    fetchSpy.mockRestore()
  })
})
