/**
 * Comment→DM replies and Instagram's one-message rule.
 *
 * A business may send ONE message (the private reply) to a commenter who has
 * not written to the page in the last 24 hours; everything after it is
 * rejected with «sent outside of allowed window». So:
 *
 *   - one short text / one key message  → it IS the private reply
 *   - the commenter wrote inside the window → every part goes out right away
 *   - otherwise → the private reply carries the opening button message, the
 *     reply is parked, and the tap (which opens the window) releases it
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  followGateFindFirst: vi.fn(),
  followGateFindMany: vi.fn(),
  followGateCreate: vi.fn(),
  followGateUpdate: vi.fn(),
  followGateUpdateMany: vi.fn(),
  automationFindMany: vi.fn(),
  automationFindUnique: vi.fn(),
  messageFindMany: vi.fn(),
  runCreate: vi.fn(),
  sendText: vi.fn(),
  sendRichEntry: vi.fn(),
  sendButtonMessage: vi.fn(),
  captureError: vi.fn(),
  captureWarning: vi.fn(),
  messageCreateMany: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    instagramFollowGate: {
      findFirst: mocks.followGateFindFirst,
      findMany: mocks.followGateFindMany,
      create: mocks.followGateCreate,
      update: mocks.followGateUpdate,
      updateMany: mocks.followGateUpdateMany,
    },
    instagramAutomation: {
      findMany: mocks.automationFindMany,
      findUnique: mocks.automationFindUnique,
    },
    instagramAutomationRun: { create: mocks.runCreate },
    message: { findMany: mocks.messageFindMany },
    $transaction: async (run: (tx: unknown) => Promise<void>) =>
      run({
        message: { createMany: mocks.messageCreateMany },
        conversation: { update: vi.fn() },
      }),
  },
}))

vi.mock('@/lib/ai/chat-engine', () => ({ generateReply: vi.fn() }))
vi.mock('@/lib/errors/capture', () => ({
  captureError: mocks.captureError,
  captureWarning: mocks.captureWarning,
}))
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

function scenario(messages: unknown[], action: Record<string, unknown> = {}) {
  return {
    id: 'auto-1',
    agentId: 'agent-1',
    channelId: 'ig-channel-1',
    type: 'COMMENT',
    name: 'بلوزشلوار',
    active: true,
    priority: 0,
    trigger: { keywords: ['الو'], matchMode: 'CONTAINS', storyScope: 'KEYWORD', postIds: [] },
    action: { replyMode: 'STATIC', dmOnComment: true, replyText: priceText, messages, ...action },
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

/** The commenter wrote a Direct message inside the 24-hour window. */
function windowOpen() {
  mocks.messageFindMany.mockResolvedValue([
    { metadata: { vigentoInbound: { channel: 'INSTAGRAM', kind: 'DM' } } },
  ])
}

function windowClosedError() {
  const error = new Error(
    'INSTAGRAM_24H_WINDOW_CLOSED: {"error":{"code":10,"error_subcode":2534022}}',
  )
  error.name = 'Instagram24hWindowError'
  return error
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.followGateFindFirst.mockResolvedValue(null)
  mocks.followGateFindMany.mockResolvedValue([])
  mocks.followGateCreate.mockResolvedValue({})
  mocks.followGateUpdate.mockResolvedValue({})
  mocks.followGateUpdateMany.mockResolvedValue({ count: 1 })
  mocks.automationFindUnique.mockResolvedValue({ id: 'auto-1', name: 'بلوزشلوار', type: 'COMMENT' })
  // Default: nobody wrote to the page recently — the window is closed.
  mocks.messageFindMany.mockResolvedValue([])
  mocks.runCreate.mockResolvedValue({})
  mocks.sendText.mockResolvedValue(undefined)
  mocks.sendRichEntry.mockResolvedValue('sent')
  mocks.sendButtonMessage.mockResolvedValue(undefined)
  mocks.messageCreateMany.mockResolvedValue({ count: 1 })
})

describe('comment→DM reply that is one message', () => {
  it('keeps a single short text as one plain private reply', async () => {
    mocks.automationFindMany.mockResolvedValue([scenario([{ type: 'TEXT', text: priceText }])])

    await runInstagramAutomation(ctx(comment))

    expect(mocks.sendRichEntry).toHaveBeenCalledTimes(1)
    expect(mocks.sendRichEntry.mock.calls[0][1]).toMatch(/^private:c-1/)
    expect(mocks.sendButtonMessage).not.toHaveBeenCalled()
    expect(mocks.followGateCreate).not.toHaveBeenCalled()
    // No reason to look the window up for a reply that needs no window.
    expect(mocks.messageFindMany).not.toHaveBeenCalled()
  })
})

describe('comment→DM reply outside the 24-hour window', () => {
  it('opens with the button message and parks the WHOLE reply', async () => {
    const messages = [{ type: 'TEXT', text: priceText }, productEntry]
    mocks.automationFindMany.mockResolvedValue([scenario(messages)])

    const result = await runInstagramAutomation(ctx(comment))

    expect(result).toEqual({ handled: true, replied: true })
    // The one private reply is the opener, with its button.
    expect(mocks.sendButtonMessage).toHaveBeenCalledTimes(1)
    const [, target, text, buttons] = mocks.sendButtonMessage.mock.calls[0]
    expect(target).toMatch(/^private:c-1/)
    expect(text).toContain('روی دکمهٔ زیر بزنید')
    expect(buttons).toEqual([{ title: 'مشاهده' }])
    // Nothing else is sent — it would be rejected and logged as a failure.
    expect(mocks.sendRichEntry).not.toHaveBeenCalled()
    // Every part waits for the tap, in order.
    expect(mocks.followGateCreate).toHaveBeenCalledTimes(1)
    const { data } = mocks.followGateCreate.mock.calls[0][0]
    expect(data).toMatchObject({ automationId: 'auto-1', igSenderId: 'igsid-1', chatId: 'igsid-1', status: 'PENDING' })
    expect(data.payload).toMatchObject({
      gateMode: 'CONTINUE',
      gateConfirmKeyword: 'مشاهده',
      contentMessages: [{ type: 'TEXT', text: priceText }, productEntry],
    })
  })

  it("uses the operator's own opener text and button (cut to Meta's 20 characters)", async () => {
    mocks.automationFindMany.mockResolvedValue([
      scenario([{ type: 'IMAGE', mediaUrl: 'https://example.com/a.jpg' }], {
        dmOpenerText: 'برای دیدن عکس و قیمت بزن 👇',
        dmOpenerButton: 'مشاهده پست و قیمت محصول ما',
      }),
    ])

    await runInstagramAutomation(ctx(comment))

    const [, , text, buttons] = mocks.sendButtonMessage.mock.calls[0]
    expect(text).toBe('برای دیدن عکس و قیمت بزن 👇')
    expect(buttons[0].title.length).toBeLessThanOrEqual(20)
    expect(mocks.followGateCreate.mock.calls[0][0].data.payload.gateConfirmKeyword).toBe(buttons[0].title)
  })

  it('treats one text too long for a single message as multi-part', async () => {
    mocks.automationFindMany.mockResolvedValue([scenario([{ type: 'TEXT', text: 'الف '.repeat(400) }])])

    await runInstagramAutomation(ctx(comment))

    expect(mocks.sendButtonMessage).toHaveBeenCalledTimes(1)
    expect(mocks.sendRichEntry).not.toHaveBeenCalled()
  })

  it('refreshes the parked reply instead of stacking a gate per comment', async () => {
    mocks.automationFindMany.mockResolvedValue([scenario([{ type: 'TEXT', text: priceText }, productEntry])])
    mocks.followGateFindFirst.mockResolvedValue({ id: 'gate-old' })

    await runInstagramAutomation(ctx(comment))

    expect(mocks.followGateCreate).not.toHaveBeenCalled()
    expect(mocks.followGateUpdate).toHaveBeenCalledWith({
      where: { id: 'gate-old' },
      data: expect.objectContaining({ payload: expect.objectContaining({ gateMode: 'CONTINUE' }) }),
    })
  })

  it('shows the opener, its button and the scenario in the inbox receipt', async () => {
    mocks.automationFindMany.mockResolvedValue([
      scenario([{ type: 'TEXT', text: priceText }, productEntry], {
        commentAckEnabled: true,
        commentAckText: 'تو دایرکت فرستادم 🌟',
      }),
    ])

    await runInstagramAutomation({ ...ctx(comment), conversationId: 'conv-1', inboundEventId: 'evt-1' })

    const [{ data }] = mocks.messageCreateMany.mock.calls[0]
    expect(data[0].metadata.vigentoOutbound).toEqual({
      scenario: { id: 'auto-1', name: 'بلوزشلوار', type: 'COMMENT' },
      parts: [
        { kind: 'buttons', role: 'opener', text: expect.any(String), buttons: [{ title: 'مشاهده' }] },
        { kind: 'text', via: 'comment', text: 'تو دایرکت فرستادم 🌟' },
      ],
    })
  })
})

describe('tap on the opening button', () => {
  const tap: InboundMessage = {
    kind: 'DM',
    platformMessageId: 'pb:1:igsid-1',
    senderId: 'igsid-1',
    senderName: 'Customer',
    text: 'مشاهده',
    chatId: 'igsid-1',
  }

  function parkedGate(payload: Record<string, unknown> = {}) {
    return {
      id: 'gate-1',
      automationId: 'auto-1',
      chatId: 'igsid-1',
      payload: {
        gateMode: 'CONTINUE',
        gateConfirmKeyword: 'مشاهده',
        contentMessages: [{ type: 'TEXT', text: priceText }, productEntry],
        ...payload,
      },
    }
  }

  it('releases every parked part to the Direct thread, with no follow check', async () => {
    mocks.followGateFindMany.mockResolvedValue([parkedGate()])
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)

    const result = await runInstagramAutomation(ctx(tap))

    expect(result).toEqual({ handled: true, replied: true })
    expect(mocks.followGateUpdateMany).toHaveBeenCalledWith({
      where: { id: 'gate-1', status: 'PENDING' },
      data: expect.objectContaining({ status: 'FULFILLED' }),
    })
    expect(mocks.sendRichEntry).toHaveBeenCalledTimes(2)
    expect(mocks.sendRichEntry.mock.calls.map((call) => call[1])).toEqual(['igsid-1', 'igsid-1'])
    // An opener has no follow rule: the Graph follow check is never asked.
    expect(fetchSpy).not.toHaveBeenCalled()
    // The run was already counted when the opener went out — not a follow.
    expect(mocks.runCreate).not.toHaveBeenCalled()
    vi.unstubAllGlobals()
  })

  it('finds the tapped button among several open gates of the same person', async () => {
    mocks.followGateFindMany.mockResolvedValue([
      { id: 'gate-newer', automationId: 'auto-2', chatId: 'igsid-1', payload: { gateMode: 'CONTINUE', gateConfirmKeyword: 'دریافت', contentMessages: [{ type: 'TEXT', text: 'x' }] } },
      parkedGate(),
    ])

    await runInstagramAutomation(ctx(tap))

    expect(mocks.followGateUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'gate-1', status: 'PENDING' } }),
    )
  })

  it('is not released by a later sentence that merely contains the button word', async () => {
    mocks.followGateFindMany.mockResolvedValue([parkedGate()])
    mocks.automationFindMany.mockResolvedValue([])

    const result = await runInstagramAutomation(ctx({ ...tap, text: 'مشاهده کردم ممنون' }))

    expect(result.handled).toBe(false)
    expect(mocks.followGateUpdateMany).not.toHaveBeenCalled()
    expect(mocks.sendRichEntry).not.toHaveBeenCalled()
  })

  it('accepts the tap of a label Meta shortened to 20 characters', async () => {
    const label = 'مشاهده پست و قیمت محصول ما'
    mocks.followGateFindMany.mockResolvedValue([parkedGate({ gateConfirmKeyword: label })])

    const result = await runInstagramAutomation(ctx({ ...tap, text: label.slice(0, 20).trim() }))

    expect(result).toEqual({ handled: true, replied: true })
    expect(mocks.sendRichEntry).toHaveBeenCalledTimes(2)
  })

  it('does not send the reply twice on a double tap', async () => {
    mocks.followGateFindMany.mockResolvedValue([parkedGate()])
    mocks.followGateUpdateMany.mockResolvedValue({ count: 0 })

    const result = await runInstagramAutomation(ctx(tap))

    expect(result.handled).toBe(true)
    expect(mocks.sendRichEntry).not.toHaveBeenCalled()
  })
})

describe('comment→DM reply inside the 24-hour window', () => {
  it('delivers every part right away — no opener, no parked gate', async () => {
    windowOpen()
    mocks.automationFindMany.mockResolvedValue([
      scenario([{ type: 'TEXT', text: priceText }, productEntry]),
    ])

    const result = await runInstagramAutomation(ctx(comment))

    expect(result.handled).toBe(true)
    expect(mocks.sendRichEntry.mock.calls.map((call) => call[1])).toEqual(['igsid-1', 'igsid-1'])
    expect(mocks.sendRichEntry.mock.calls[1][2]).toMatchObject(productEntry)
    expect(mocks.sendButtonMessage).not.toHaveBeenCalled()
    expect(mocks.followGateCreate).not.toHaveBeenCalled()
  })

  it('does not count a comment or a reaction as an open window', async () => {
    mocks.messageFindMany.mockResolvedValue([
      { metadata: { vigentoInbound: { channel: 'INSTAGRAM', kind: 'COMMENT' } } },
      { metadata: { vigentoInbound: { channel: 'INSTAGRAM', kind: 'REACTION' } } },
    ])
    mocks.automationFindMany.mockResolvedValue([
      scenario([{ type: 'TEXT', text: priceText }, productEntry]),
    ])

    await runInstagramAutomation(ctx(comment))

    expect(mocks.sendButtonMessage).toHaveBeenCalledTimes(1)
    expect(mocks.sendRichEntry).not.toHaveBeenCalled()
  })

  it('falls back to the opener when Meta says the window is closed after all', async () => {
    windowOpen()
    mocks.automationFindMany.mockResolvedValue([
      scenario([{ type: 'TEXT', text: priceText }, productEntry]),
    ])
    mocks.sendRichEntry.mockRejectedValueOnce(windowClosedError())

    const result = await runInstagramAutomation(ctx(comment))

    // The first part went to the IGSID, so the private reply was still unspent.
    expect(mocks.sendRichEntry).toHaveBeenCalledTimes(1)
    expect(mocks.sendButtonMessage).toHaveBeenCalledTimes(1)
    expect(mocks.sendButtonMessage.mock.calls[0][1]).toMatch(/^private:c-1/)
    expect(mocks.followGateCreate).toHaveBeenCalledTimes(1)
    expect(result).toEqual({ handled: true, replied: true })
    expect(mocks.captureError).not.toHaveBeenCalled()
  })

  it('still delivers later parts when one of them fails', async () => {
    windowOpen()
    mocks.automationFindMany.mockResolvedValue([
      scenario([
        { type: 'TEXT', text: priceText },
        { type: 'IMAGE', mediaUrl: 'https://example.com/a.jpg' },
        productEntry,
      ]),
    ])
    mocks.sendRichEntry
      .mockResolvedValueOnce('sent')
      .mockRejectedValueOnce(new Error('bad attachment'))
      .mockResolvedValueOnce('sent')

    await runInstagramAutomation(ctx(comment))

    expect(mocks.sendRichEntry).toHaveBeenCalledTimes(3)
    expect(mocks.sendRichEntry.mock.calls[2][2]).toMatchObject(productEntry)
  })

  it('receipts only the parts Meta accepted, part by part', async () => {
    windowOpen()
    mocks.automationFindMany.mockResolvedValue([
      scenario([
        { type: 'IMAGE', mediaUrl: 'https://example.com/first.jpg', text: 'کپشن' },
        { type: 'IMAGE', mediaUrl: 'https://example.com/rejected.jpg' },
        { type: 'VIDEO', mediaUrl: 'https://example.com/ok.mp4' },
      ]),
    ])
    // sendRichEntry captures a rejected part and reports it instead of throwing.
    mocks.sendRichEntry
      .mockResolvedValueOnce('sent')
      .mockResolvedValueOnce('failed')
      .mockResolvedValueOnce('sent')

    await runInstagramAutomation({ ...ctx(comment), conversationId: 'conv-1', inboundEventId: 'evt-1' })

    // The rejected image must not show up in the CRM inbox.
    const [{ data }] = mocks.messageCreateMany.mock.calls[0]
    expect(data[0].content).toBe('[تصویر]\n\n[ویدیو]')
    expect(data[0].metadata).toEqual({
      vigentoOutbound: {
        media: [
          { kind: 'photo', mediaUrl: 'https://example.com/first.jpg' },
          { kind: 'video', mediaUrl: 'https://example.com/ok.mp4' },
        ],
        parts: [
          { kind: 'media', media: 'photo', mediaUrl: 'https://example.com/first.jpg', caption: 'کپشن' },
          { kind: 'media', media: 'video', mediaUrl: 'https://example.com/ok.mp4' },
        ],
        scenario: { id: 'auto-1', name: 'بلوزشلوار', type: 'COMMENT' },
      },
    })
  })

  it('only logs a window that closes mid-sequence — no notify, no escalation', async () => {
    windowOpen()
    mocks.automationFindMany.mockResolvedValue([
      scenario([
        { type: 'IMAGE', mediaUrl: 'https://example.com/first.jpg' },
        { type: 'TEXT', text: 'part-2' },
      ]),
    ])
    const closed = windowClosedError()
    mocks.sendRichEntry.mockResolvedValueOnce('sent').mockRejectedValueOnce(closed)

    const result = await runInstagramAutomation({ ...ctx(comment), conversationId: 'conv-1', inboundEventId: 'evt-1' })

    // The run resolves — no throw, so the thread is never handed to an
    // operator. The failure is only captured to the ErrorLog.
    expect(result.handled).toBe(true)
    expect(mocks.captureError).toHaveBeenCalledWith('instagram:automation:auto-1', closed, expect.anything())
    // The part that DID reach the customer is still in the inbox.
    expect(mocks.messageCreateMany).toHaveBeenCalledTimes(1)
    expect(mocks.messageCreateMany.mock.calls[0][0].data[0].content).toBe('[تصویر]')
  })
})
