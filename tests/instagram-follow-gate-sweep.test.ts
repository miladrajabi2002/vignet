/**
 * Follow-gate sweep + confirm-tap contract:
 *   - a gate is consumed only when content really reached the customer
 *   - the PENDING → FULFILLED claim is atomic (no double delivery)
 *   - checks back off and are ranked least-recently-checked first
 *   - a missing follow field is a failed check, never «does not follow»
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  gateFindMany: vi.fn(),
  gateFindFirst: vi.fn(),
  gateFindUnique: vi.fn(),
  gateUpdate: vi.fn(),
  gateUpdateMany: vi.fn(),
  agentFindUnique: vi.fn(),
  channelFindFirst: vi.fn(),
  conversationFindFirst: vi.fn(),
  conversationUpdate: vi.fn(),
  messageCreate: vi.fn(),
  runCreate: vi.fn(),
  transaction: vi.fn(),
  sendRichEntry: vi.fn(),
  sendInstagramText: vi.fn(),
  sendButtonMessage: vi.fn(),
  sendText: vi.fn(),
  checkWorkspaceActive: vi.fn(),
  captureError: vi.fn(),
  captureWarning: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    instagramFollowGate: {
      findMany: mocks.gateFindMany,
      findFirst: mocks.gateFindFirst,
      findUnique: mocks.gateFindUnique,
      update: mocks.gateUpdate,
      updateMany: mocks.gateUpdateMany,
    },
    instagramAutomation: { findMany: vi.fn().mockResolvedValue([]) },
    instagramAutomationRun: { create: mocks.runCreate },
    agent: { findUnique: mocks.agentFindUnique },
    agentChannel: { findFirst: mocks.channelFindFirst },
    conversation: { findFirst: mocks.conversationFindFirst, update: mocks.conversationUpdate },
    message: { create: mocks.messageCreate },
    $transaction: mocks.transaction,
  },
}))

vi.mock('@/lib/ai/chat-engine', () => ({ generateReply: vi.fn() }))
vi.mock('@/lib/errors/capture', () => ({
  captureError: mocks.captureError,
  captureWarning: mocks.captureWarning,
}))
vi.mock('@/lib/billing/entitlements', () => ({
  checkWorkspaceActive: mocks.checkWorkspaceActive,
}))
vi.mock('@/lib/instagram/media', () => ({
  sendImage: vi.fn(),
  sendAudio: vi.fn(),
  sendVideo: vi.fn(),
  sendProductCard: vi.fn(),
  sendRichEntry: mocks.sendRichEntry,
  sendButtonMessage: mocks.sendButtonMessage,
  sendInstagramText: mocks.sendInstagramText,
  pickTemplateImageUrl: vi.fn(() => null),
}))
vi.mock('@/lib/instagram/config', () => ({
  readAutomationPolicy: vi.fn(() => null),
  readUserToken: vi.fn(() => 'token'),
  readPageToken: vi.fn(() => 'token'),
}))

import {
  gateAutoCheckGapMs,
  runInstagramAutomation,
  sweepInstagramFollowGates,
} from '@/lib/instagram/automation'
import type { InboundMessage, MessengerAdapter } from '@/lib/channels/types'

const MIN = 60_000
const HOUR = 60 * MIN

function gate(overrides: Record<string, unknown> = {}, payload: Record<string, unknown> = {}) {
  return {
    id: 'gate-1',
    agentId: 'agent-1',
    automationId: 'auto-1',
    igSenderId: 'igsid-1',
    chatId: 'igsid-1',
    createdAt: new Date(Date.now() - 10 * MIN),
    automation: { type: 'COMMENT', active: true },
    payload: {
      gateMode: 'SOFT',
      gateConfirmKeyword: 'دنبال کردم',
      contentMessages: [
        { type: 'TEXT', text: 'کد تخفیف: VIG10' },
        { type: 'IMAGE', mediaUrl: 'https://cdn.example.com/a.jpg' },
      ],
      ...payload,
    },
    ...overrides,
  }
}

/** Graph API answer for the follow check. */
function followApi(body: unknown, ok = true) {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({ ok, status: ok ? 200 : 400, text: async () => JSON.stringify(body) }),
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.gateFindMany.mockResolvedValue([gate()])
  mocks.gateFindUnique.mockImplementation(async () => ({ payload: gate().payload }))
  mocks.gateUpdate.mockResolvedValue({})
  mocks.gateUpdateMany.mockResolvedValue({ count: 1 })
  mocks.agentFindUnique.mockResolvedValue({ workspaceId: 'workspace-1' })
  mocks.channelFindFirst.mockResolvedValue({ config: { accessToken: 'token' } })
  mocks.checkWorkspaceActive.mockResolvedValue({ allowed: true })
  mocks.conversationFindFirst.mockResolvedValue({ id: 'conv-1' })
  mocks.transaction.mockResolvedValue([])
  mocks.runCreate.mockResolvedValue({})
  mocks.sendRichEntry.mockResolvedValue('sent')
  mocks.sendText.mockResolvedValue(undefined)
  mocks.sendButtonMessage.mockResolvedValue(undefined)
  followApi({ is_user_follow_business: true })
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('follow-gate sweep', () => {
  it('delivers the parked content, receipts it in the inbox and logs the run', async () => {
    const fulfilled = await sweepInstagramFollowGates()

    expect(fulfilled).toBe(1)
    expect(mocks.gateUpdateMany).toHaveBeenCalledWith({
      where: { id: 'gate-1', status: 'PENDING' },
      data: expect.objectContaining({ status: 'FULFILLED' }),
    })
    expect(mocks.sendRichEntry).toHaveBeenCalledTimes(2)
    expect(mocks.messageCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        conversationId: 'conv-1',
        role: 'ASSISTANT',
        content: 'کد تخفیف: VIG10\n\n[تصویر]',
      }),
    })
    expect(mocks.runCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ outcome: 'FOLLOW_CONFIRMED', conversationId: 'conv-1' }),
    })
  })

  it('hands the gate back when Meta rejects the first part', async () => {
    mocks.sendRichEntry.mockResolvedValue('failed')

    const fulfilled = await sweepInstagramFollowGates()

    expect(fulfilled).toBe(0)
    // Stops after the rejected first part — nothing else is attempted.
    expect(mocks.sendRichEntry).toHaveBeenCalledTimes(1)
    expect(mocks.gateUpdate).toHaveBeenCalledWith({
      where: { id: 'gate-1' },
      data: expect.objectContaining({
        status: 'PENDING',
        fulfilledAt: null,
        payload: expect.objectContaining({ autoDeliverFailures: 1 }),
      }),
    })
    expect(mocks.runCreate).not.toHaveBeenCalled()
    expect(mocks.messageCreate).not.toHaveBeenCalled()
  })

  it('hands the gate back on a closed 24-hour window', async () => {
    const windowClosed = new Error('{"error":{"code":10,"error_subcode":2534022}}')
    windowClosed.name = 'Instagram24hWindowError'
    mocks.sendRichEntry.mockRejectedValue(windowClosed)

    expect(await sweepInstagramFollowGates()).toBe(0)
    expect(mocks.sendRichEntry).toHaveBeenCalledTimes(1)
    expect(mocks.gateUpdate).toHaveBeenCalledWith({
      where: { id: 'gate-1' },
      data: expect.objectContaining({ status: 'PENDING' }),
    })
  })

  it('keeps a partially delivered gate fulfilled and receipts only what went out', async () => {
    mocks.sendRichEntry.mockResolvedValueOnce('sent').mockResolvedValueOnce('failed')

    expect(await sweepInstagramFollowGates()).toBe(1)
    expect(mocks.gateUpdate).not.toHaveBeenCalled()
    expect(mocks.messageCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ content: 'کد تخفیف: VIG10' }),
    })
  })

  it('does not deliver when a confirm tap already claimed the gate', async () => {
    mocks.gateUpdateMany.mockResolvedValue({ count: 0 })

    expect(await sweepInstagramFollowGates()).toBe(0)
    expect(mocks.sendRichEntry).not.toHaveBeenCalled()
  })

  it('only stamps the backoff marker while the customer does not follow', async () => {
    followApi({ is_user_follow_business: false })

    expect(await sweepInstagramFollowGates()).toBe(0)
    expect(mocks.gateUpdateMany).not.toHaveBeenCalled()
    expect(mocks.gateUpdate).toHaveBeenCalledWith({
      where: { id: 'gate-1' },
      data: { payload: expect.objectContaining({ lastAutoCheckAt: expect.any(Number) }) },
    })
  })

  it('never delivers on a failed or inconclusive follow check', async () => {
    followApi({ id: 'igsid-1' }) // field omitted by Meta
    expect(await sweepInstagramFollowGates()).toBe(0)
    followApi({ error: { code: 4 } }, false)
    expect(await sweepInstagramFollowGates()).toBe(0)
    expect(mocks.sendRichEntry).not.toHaveBeenCalled()
  })

  it('skips paused scenarios, expired workspaces and exhausted gates without a Graph call', async () => {
    mocks.gateFindMany.mockResolvedValue([
      gate({ id: 'paused', automation: { type: 'COMMENT', active: false } }),
      gate({ id: 'exhausted' }, { autoDeliverFailures: 3 }),
      gate({ id: 'mention' }, { gateMode: 'STORY_MENTION' }),
    ])
    expect(await sweepInstagramFollowGates()).toBe(0)
    expect(fetch).not.toHaveBeenCalled()

    mocks.gateFindMany.mockResolvedValue([gate()])
    mocks.checkWorkspaceActive.mockResolvedValue({ allowed: false, reason: 'SUBSCRIPTION_EXPIRED' })
    expect(await sweepInstagramFollowGates()).toBe(0)
    expect(fetch).not.toHaveBeenCalled()
  })

  it('backs off quiet gates and checks the least-recently-checked first', async () => {
    const now = Date.now()
    mocks.gateFindMany.mockResolvedValue([
      // 12 h old, checked 30 min ago → not due (gap is 2 h).
      gate({ id: 'quiet', igSenderId: 'quiet', createdAt: new Date(now - 12 * HOUR) }, { lastAutoCheckAt: now - 30 * MIN }),
      // Same age but tapped a minute ago → fast cadence again.
      gate({ id: 'tapped', igSenderId: 'tapped', createdAt: new Date(now - 12 * HOUR) }, { lastAutoCheckAt: now - 6 * MIN, lastTapAt: now - MIN }),
      gate({ id: 'never', igSenderId: 'never' }),
    ])
    followApi({ is_user_follow_business: false })

    await sweepInstagramFollowGates()

    const checked = vi.mocked(fetch).mock.calls.map(([url]) => String(url).split('/v22.0/')[1].split('?')[0])
    expect(checked).toEqual(['never', 'tapped'])
  })

  it('spaces checks from every cycle up to once per two hours', () => {
    expect(gateAutoCheckGapMs(0)).toBe(4 * MIN)
    expect(gateAutoCheckGapMs(20 * MIN)).toBe(4 * MIN)
    expect(gateAutoCheckGapMs(HOUR)).toBe(10 * MIN)
    expect(gateAutoCheckGapMs(40 * HOUR)).toBe(2 * HOUR)
  })
})

describe('follow-gate confirm tap', () => {
  const tap: InboundMessage = {
    kind: 'DM',
    platformMessageId: 'pb:1:igsid-1',
    senderId: 'igsid-1',
    senderName: 'Customer',
    text: 'دنبال کردم',
    chatId: 'igsid-1',
  }

  function ctx(msg: InboundMessage = tap) {
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

  beforeEach(() => {
    mocks.gateFindFirst.mockResolvedValue(gate())
  })

  it('delivers once when the follow is visible', async () => {
    const result = await runInstagramAutomation(ctx())

    expect(result).toEqual({ handled: true, replied: true })
    expect(mocks.sendRichEntry).toHaveBeenCalledTimes(2)
  })

  it('swallows a second tap that lost the claim — no duplicate content', async () => {
    mocks.gateUpdateMany.mockResolvedValue({ count: 0 })

    const result = await runInstagramAutomation(ctx())

    expect(result.handled).toBe(true)
    expect(mocks.sendRichEntry).not.toHaveBeenCalled()
    expect(mocks.runCreate).not.toHaveBeenCalled()
  })

  it('re-prompts and restarts the sweep cadence when the customer has not followed yet', async () => {
    followApi({ is_user_follow_business: false })

    const result = await runInstagramAutomation(ctx())

    expect(result.handled).toBe(true)
    expect(mocks.sendRichEntry).not.toHaveBeenCalled()
    expect(mocks.sendButtonMessage).toHaveBeenCalledTimes(1)
    expect(mocks.gateUpdate).toHaveBeenCalledWith({
      where: { id: 'gate-1' },
      data: { payload: expect.objectContaining({ lastTapAt: expect.any(Number), lastAutoCheckAt: 0 }) },
    })
    expect(mocks.gateUpdateMany).not.toHaveBeenCalled()
  })

  it('matches an emoji-only confirm button and rejects a keyword buried in another word', async () => {
    mocks.gateFindFirst.mockResolvedValue(gate({}, { gateConfirmKeyword: '✅' }))
    expect((await runInstagramAutomation(ctx({ ...tap, text: '✅' }))).handled).toBe(true)

    vi.clearAllMocks()
    mocks.gateFindFirst.mockResolvedValue(gate({}, { gateConfirmKeyword: 'ok' }))
    expect((await runInstagramAutomation(ctx({ ...tap, text: 'book' }))).handled).toBe(false)
  })
})
