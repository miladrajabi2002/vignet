/**
 * Consecutive-message batching (wait-and-merge).
 *
 * Contract tested here:
 *   1. shouldBatchConsecutiveMessages: only DM-thread kinds with text.
 *   2. absorbConsecutiveInboundMessages: newer sibling ledger events are
 *      atomically finalized as COMPLETED with outcome=MERGED_INTO_TURN,
 *      persisted as USER messages, and returned in arrival order.
 *   3. combineTurnText: base + absorbed texts joined with newlines.
 *   4. opt-out / media-only siblings are left untouched.
 */
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'

// ESM imports are hoisted above plain statements, so the env knobs must be
// set inside vi.hoisted() to run before the batching module is evaluated.
vi.hoisted(() => {
  process.env.INBOUND_BATCH_QUIET_MS = '300'
  process.env.INBOUND_BATCH_POLL_MS = '50'
  process.env.INBOUND_BATCH_MAX_WINDOW_MS = '2000'
})

const mocks = vi.hoisted(() => ({
  inboundEventFindMany: vi.fn(),
  inboundEventUpdateMany: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    inboundEvent: {
      findMany: mocks.inboundEventFindMany,
      updateMany: mocks.inboundEventUpdateMany,
    },
  },
}))

import {
  absorbConsecutiveInboundMessages,
  combineTurnText,
  shouldBatchConsecutiveMessages,
} from '@/lib/channels/batching'
import type { InboundMessage } from '@/lib/channels/types'

function dm(text: string, kind?: InboundMessage['kind']): InboundMessage {
  return {
    chatId: 'ig-user-1',
    senderId: 'ig-user-1',
    text,
    ...(kind ? { kind } : {}),
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.inboundEventUpdateMany.mockResolvedValue({ count: 1 })
})

afterAll(() => {
  delete process.env.INBOUND_BATCH_QUIET_MS
  delete process.env.INBOUND_BATCH_POLL_MS
  delete process.env.INBOUND_BATCH_MAX_WINDOW_MS
})

describe('shouldBatchConsecutiveMessages', () => {
  it('batches plain DMs and story replies with text', () => {
    expect(shouldBatchConsecutiveMessages('INSTAGRAM', dm('سلام', 'DM'))).toBe(true)
    expect(shouldBatchConsecutiveMessages('INSTAGRAM', dm('سلام', 'STORY_REPLY'))).toBe(true)
    expect(shouldBatchConsecutiveMessages('TELEGRAM', dm('سلام'))).toBe(true)
  })

  it('never batches comments, reactions or media-only messages', () => {
    expect(shouldBatchConsecutiveMessages('INSTAGRAM', dm('nice', 'COMMENT'))).toBe(false)
    expect(shouldBatchConsecutiveMessages('INSTAGRAM', dm('❤️', 'REACTION'))).toBe(false)
    expect(shouldBatchConsecutiveMessages('INSTAGRAM', { ...dm(''), kind: 'DM' })).toBe(false)
  })
})

describe('absorbConsecutiveInboundMessages', () => {
  it('absorbs newer siblings, finalizes them as MERGED_INTO_TURN and keeps arrival order', async () => {
    mocks.inboundEventFindMany
      .mockResolvedValueOnce([
        {
          id: 'event-2',
          eventType: 'DM',
          payload: { text: 'خوبین', kind: 'DM', chatId: 'ig-user-1' },
        },
        {
          id: 'event-3',
          eventType: 'DM',
          payload: { text: 'محصول فلان رو دارین؟', kind: 'DM', chatId: 'ig-user-1' },
        },
      ])
      .mockResolvedValue([])

    const persisted: Array<{ text: string; eventId: string }> = []
    const absorbed = await absorbConsecutiveInboundMessages({
      workspaceId: 'ws-1',
      channelId: 'ch-1',
      conversationKey: 'ig-user-1',
      conversationId: 'conv-1',
      currentEventId: 'event-1',
      persistInbound: async (text, eventId) => {
        persisted.push({ text, eventId })
        return `msg-${persisted.length}`
      },
    })

    expect(absorbed.map((a) => a.text)).toEqual(['خوبین', 'محصول فلان رو دارین؟'])
    expect(persisted).toEqual([
      { text: 'خوبین', eventId: 'event-2' },
      { text: 'محصول فلان رو دارین؟', eventId: 'event-3' },
    ])
    // Per absorbed sibling: 1 atomic COMPLETED takeover + 1 inboundMessageId
    // attach = 2 updateMany writes, in takeover order.
    expect(mocks.inboundEventUpdateMany).toHaveBeenCalledTimes(4)
    const takeover2 = mocks.inboundEventUpdateMany.mock.calls[0][0]
    expect(takeover2.where).toEqual({ id: 'event-2', state: { in: ['RECEIVED', 'PROCESSING'] } })
    expect(takeover2.data.state).toBe('COMPLETED')
    expect(takeover2.data.result).toEqual({
      outcome: 'MERGED_INTO_TURN',
      mergedInto: 'event-1',
    })
    expect(mocks.inboundEventUpdateMany.mock.calls[1][0]).toEqual({
      where: { id: 'event-2', state: 'COMPLETED' },
      data: { inboundMessageId: 'msg-1' },
    })
    const takeover3 = mocks.inboundEventUpdateMany.mock.calls[2][0]
    expect(takeover3.where).toEqual({ id: 'event-3', state: { in: ['RECEIVED', 'PROCESSING'] } })
    expect(mocks.inboundEventUpdateMany.mock.calls[3][0]).toEqual({
      where: { id: 'event-3', state: 'COMPLETED' },
      data: { inboundMessageId: 'msg-2' },
    })
  })

  it('leaves opt-out and media-only siblings untouched', async () => {
    mocks.inboundEventFindMany
      .mockResolvedValueOnce([
        { id: 'event-stop', eventType: 'DM', payload: { text: 'لغو', kind: 'DM' } },
        { id: 'event-media', eventType: 'DM', payload: { text: '', kind: 'DM' } },
      ])
      .mockResolvedValue([])

    const absorbed = await absorbConsecutiveInboundMessages({
      workspaceId: 'ws-1',
      channelId: 'ch-1',
      conversationKey: 'ig-user-1',
      conversationId: 'conv-1',
      currentEventId: 'event-1',
      persistInbound: async () => 'msg-x',
    })

    expect(absorbed).toEqual([])
    expect(mocks.inboundEventUpdateMany).not.toHaveBeenCalled()
  })

  it('skips candidates lost to a competing writer', async () => {
    mocks.inboundEventFindMany
      .mockResolvedValueOnce([
        { id: 'event-race', eventType: 'DM', payload: { text: 'سلام', kind: 'DM' } },
      ])
      .mockResolvedValue([])
    mocks.inboundEventUpdateMany.mockResolvedValueOnce({ count: 0 })

    const absorbed = await absorbConsecutiveInboundMessages({
      workspaceId: 'ws-1',
      channelId: 'ch-1',
      conversationKey: 'ig-user-1',
      conversationId: 'conv-1',
      currentEventId: 'event-1',
      persistInbound: async () => 'msg-x',
    })

    expect(absorbed).toEqual([])
  })
})

describe('combineTurnText', () => {
  it('joins the leading message and absorbed siblings with newlines', () => {
    expect(
      combineTurnText('سلام', [
        { eventId: 'e2', text: 'خوبین' },
        { eventId: 'e3', text: 'محصول فلان رو دارین؟' },
      ]),
    ).toBe('سلام\nخوبین\nمحصول فلان رو دارین؟')
  })

  it('returns the base text when nothing was absorbed', () => {
    expect(combineTurnText('سلام', [])).toBe('سلام')
  })
})
