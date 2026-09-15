import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  advanceConversationWorkingState,
  createEmptyConversationWorkingState,
  loadConversationWorkingState,
  persistConversationWorkingState,
} from '@/lib/ai/conversation-state'

const mocks = vi.hoisted(() => ({
  findState: vi.fn(),
  findMessages: vi.fn(),
  createState: vi.fn(),
  updateState: vi.fn(),
  loadSession: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    conversationState: {
      findUnique: mocks.findState,
      createMany: mocks.createState,
      updateMany: mocks.updateState,
    },
    message: { findMany: mocks.findMessages },
  },
}))

vi.mock('@/lib/conversations/session-store', () => ({
  loadConversationSession: mocks.loadSession,
  sessionMessageWhere: () => ({ createdAt: { lte: new Date('2026-01-01T12:00:00Z') } }),
}))

type Row = { id: string; role: string; content: string; createdAt: Date; inboundEventId?: string | null }

function row(index: number, role: 'USER' | 'ASSISTANT', content: string): Row {
  return {
    id: `m-${String(index).padStart(4, '0')}`,
    role,
    content,
    createdAt: new Date(Date.UTC(2026, 0, 1, 0, index)),
    inboundEventId: null,
  }
}

beforeEach(() => {
  vi.resetAllMocks()
  mocks.loadSession.mockResolvedValue({
    start: { id: 'session-start', role: 'USER', createdAt: new Date('2026-01-01T00:00:00Z') },
    asOf: new Date('2026-01-01T12:00:00Z'),
    restarted: false,
  })
  mocks.findState.mockResolvedValue(null)
  mocks.createState.mockResolvedValue({ count: 1 })
  mocks.updateState.mockResolvedValue({ count: 1 })
})

describe('conversation state persistence and recovery', () => {
  it('cold-starts from the most recent bounded transcript window', async () => {
    const rows = Array.from({ length: 300 }, (_, index) =>
      row(index, index % 2 ? 'ASSISTANT' : 'USER', index === 298 ? 'مانتو میخوام' : `پیام ${index}`))
    mocks.findMessages.mockImplementation(async ({ orderBy, take }) => {
      const sorted = [...rows].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
      if (orderBy[0].createdAt === 'desc') sorted.reverse()
      return sorted.slice(0, take)
    })

    const loaded = await loadConversationWorkingState('conversation')
    expect(mocks.findMessages).toHaveBeenCalledTimes(1)
    expect(mocks.findMessages.mock.calls[0][0].orderBy[0]).toEqual({ createdAt: 'desc' })
    expect(mocks.findMessages.mock.calls[0][0].take).toBe(240)
    expect(loaded.state.throughId).toBe('m-0299')
    expect(loaded.state.activeGoal?.label).toBe('مانتو میخوام')
    expect(loaded.expectedRevision).toBeNull()
  })

  it('rebuilds the exact multi-turn Javaheri goal instead of trusting the bad assistant restart', async () => {
    const rows = [
      row(1, 'USER', 'سلام'),
      row(2, 'ASSISTANT', 'سلام! چطور می‌تونم کمکتون کنم؟'),
      row(3, 'USER', 'جلومبلی میخواستم'),
      row(4, 'ASSISTANT', 'چه سبکی مدنظرتونه؛ مدرن یا کلاسیک؟'),
      row(5, 'USER', 'میخوام برای مبل سبز مناسب باشه'),
      row(6, 'ASSISTANT', 'دنبال چه محصولی هستید؟ جلومبلی، عسلی یا میز تلویزیون؟'),
      row(7, 'USER', 'مدرنه'),
      row(8, 'ASSISTANT', 'سلام، چطور می‌تونم کمکتون کنم؟'),
    ]
    mocks.findMessages.mockResolvedValue([...rows].reverse())

    const loaded = await loadConversationWorkingState('conversation')
    expect(loaded.state.activeGoal).toMatchObject({ intent: 'PRODUCT', label: 'جلومبلی میخواستم' })
    expect(loaded.state.searchAnchors).toContain('جلومبلی')
    expect(loaded.state.searchAnchors).not.toContain('میخواستم')
    expect(loaded.state.slots.color?.normalizedValue).toBe('سبز')
    expect(loaded.state.slots.style?.normalizedValue).toBe('مدرن')
    expect(loaded.state.throughId).toBe('m-0008')
  })

  it('replays every unseen batch after a saved cursor without gaps', async () => {
    let saved = createEmptyConversationWorkingState('session-start')
    saved = advanceConversationWorkingState({
      state: saved,
      sessionStartId: 'session-start',
      message: 'کفش میخوام',
      messageId: 'm-0000',
      createdAt: new Date('2026-01-01T00:00:00Z'),
    })
    mocks.findState.mockResolvedValue({
      conversationId: 'conversation',
      sessionStartId: 'session-start',
      state: saved,
      throughId: saved.throughId,
      throughAt: new Date(saved.throughAt),
      revision: 7,
    })
    const unseen = Array.from({ length: 241 }, (_, index) =>
      row(index + 1, index % 2 ? 'ASSISTANT' : 'USER', index === 240 ? 'مشکی باشه' : `ادامه ${index}`))
    mocks.findMessages
      .mockResolvedValueOnce(unseen.slice(0, 240))
      .mockResolvedValueOnce(unseen.slice(240))

    const loaded = await loadConversationWorkingState('conversation')
    expect(mocks.findMessages).toHaveBeenCalledTimes(2)
    expect(loaded.state.throughId).toBe(unseen.at(-1)?.id)
    expect(loaded.expectedRevision).toBe(7)
  })

  it('starts a clean state when the 48-hour session boundary changes', async () => {
    const old = advanceConversationWorkingState({
      state: createEmptyConversationWorkingState('old-session'),
      sessionStartId: 'old-session',
      message: 'مبل میخوام',
      messageId: 'old-message',
      createdAt: new Date('2025-12-01T00:00:00Z'),
    })
    mocks.findState.mockResolvedValue({
      conversationId: 'conversation', sessionStartId: 'old-session', state: old,
      throughId: old.throughId, throughAt: new Date(old.throughAt), revision: 3,
    })
    mocks.findMessages.mockResolvedValue([])
    const loaded = await loadConversationWorkingState('conversation')
    expect(loaded.state.activeGoal).toBeNull()
    expect(loaded.state.sessionStartId).toBe('session-start')
    // Existing row is replaced with a CAS update instead of a racy create.
    expect(loaded.expectedRevision).toBe(3)
  })

  it('excludes the current durable inbound event from replay', async () => {
    mocks.findMessages.mockResolvedValue([])
    await loadConversationWorkingState('conversation', 'event-current')
    const where = mocks.findMessages.mock.calls[0][0].where
    expect(JSON.stringify(where)).toContain('inboundEventId')
    expect(JSON.stringify(where)).toContain('event-current')
  })

  it('creates once and uses revision CAS for subsequent snapshots', async () => {
    const state = advanceConversationWorkingState({
      state: createEmptyConversationWorkingState('session-start'),
      sessionStartId: 'session-start',
      message: 'کتاب میخوام',
      messageId: 'u-1',
      createdAt: new Date(),
    })
    expect(await persistConversationWorkingState({
      conversationId: 'conversation', state, expectedRevision: null,
    })).toBe(true)
    expect(mocks.createState).toHaveBeenCalledWith(expect.objectContaining({ skipDuplicates: true }))

    expect(await persistConversationWorkingState({
      conversationId: 'conversation', state, expectedRevision: 4,
    })).toBe(true)
    expect(mocks.updateState).toHaveBeenCalledWith(expect.objectContaining({
      where: { conversationId: 'conversation', revision: 4 },
      data: expect.objectContaining({ revision: { increment: 1 } }),
    }))
  })

  it('reports a lost CAS instead of overwriting a concurrent newer turn', async () => {
    mocks.updateState.mockResolvedValue({ count: 0 })
    const state = createEmptyConversationWorkingState('session-start')
    expect(await persistConversationWorkingState({
      conversationId: 'conversation', state, expectedRevision: 9,
    })).toBe(false)
  })
})
