import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ConversationMemory, Prisma } from '@prisma/client'
import { loadConversationHistory, isConversationMemory, HISTORY_TOKEN_BUDGET, estimateHistoryTokens } from '@/lib/ai/conversation-memory'
import { historyForProductTurn, planProductRequest } from '@/lib/ai/conversation'
import { loadConversationSession } from '@/lib/conversations/session-store'

const mocks = vi.hoisted(() => ({
  findMessages: vi.fn(), findFirst: vi.fn(), findConversation: vi.fn(), createMemory: vi.fn(),
  updateMemory: vi.fn(), findMemory: vi.fn(), usage: vi.fn(), completion: vi.fn(),
  key: vi.fn(), budget: vi.fn(),
}))
vi.mock('@/lib/prisma', () => ({ prisma: {
  message: { findMany: mocks.findMessages, findFirst: mocks.findFirst },
  conversation: { findUnique: mocks.findConversation },
  conversationMemory: { create: mocks.createMemory, updateMany: mocks.updateMemory, findUnique: mocks.findMemory },
  usageLog: { create: mocks.usage },
} }))
vi.mock('@/lib/ai/openrouter', () => ({ chatCompletion: mocks.completion, getPlatformOpenRouterKey: mocks.key }))
vi.mock('@/lib/ai/platform-config', () => ({
  getPlatformAiConfig: async () => ({ providerModels: {} }),
  hasPlatformAiBudget: mocks.budget,
  applyPlatformModelPolicy: () => 'fast',
}))

type Row = { id: string; conversationId: string; createdAt: Date; role: string; content: string; inboundEventId: string | null }
let rows: Row[]
let memory: ConversationMemory | null

// Evaluate the actual query predicates against a small in-memory thread so
// pagination, ordering and event exclusions are exercised together.
function matches(row: Row, where: Prisma.MessageWhereInput): boolean {
  return Object.entries(where).every(([key, value]) => {
    if (key === 'AND' || key === 'OR') {
      const items = (Array.isArray(value) ? value : [value]) as Prisma.MessageWhereInput[]
      return key === 'AND' ? items.every((item) => matches(row, item)) : items.some((item) => matches(row, item))
    }
    const actual = row[key as keyof Row]
    if (value instanceof Date) return (actual as Date).getTime() === value.getTime()
    if (value !== null && typeof value === 'object') {
      const filter = value as { gt?: string | Date; lt?: string | Date; gte?: string | Date; lte?: string | Date; in?: unknown[]; not?: unknown }
      if (filter.gt !== undefined) return actual !== null && actual > filter.gt
      if (filter.lt !== undefined) return actual !== null && actual < filter.lt
      if (filter.gte !== undefined) return actual !== null && actual >= filter.gte
      if (filter.lte !== undefined) return actual !== null && actual <= filter.lte
      if (filter.in) return filter.in.includes(actual)
      if ('not' in filter) return actual !== null && actual !== filter.not
    }
    return actual === value
  })
}

function append(count: number) {
  const start = rows.length
  for (let index = start; index < start + count; index++) rows.push({
    id: `m${String(index).padStart(4, '0')}`, conversationId: 'thread',
    createdAt: new Date(Date.UTC(2026, 0, 1, 0, index)),
    role: index % 2 ? 'ASSISTANT' : 'USER', content: `message-${index}`,
    inboundEventId: null,
  })
}

beforeEach(() => {
  vi.resetAllMocks()
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-01-01T12:00:00Z'))
  rows = []
  memory = null
  mocks.key.mockReturnValue('test-key')
  mocks.budget.mockResolvedValue(true)
  mocks.findMessages.mockImplementation(async ({ where, orderBy, take }) => {
    const selected = rows.filter((row) => matches(row, where)).sort((a, b) =>
      a.createdAt.getTime() - b.createdAt.getTime() || a.id.localeCompare(b.id))
    return (orderBy[0].createdAt === 'desc' ? selected.reverse() : selected).slice(0, take)
  })
  mocks.findFirst.mockImplementation(async ({ where }) => rows.find((row) => matches(row, where)) ?? null)
  mocks.findConversation.mockImplementation(async () => ({
    workspaceId: 'workspace', agentId: 'agent', agent: { language: 'fa' }, memory,
    summary: 'An unrelated operator summary must never be used as rolling memory',
  }))
  mocks.createMemory.mockImplementation(async ({ data }) => {
    memory = { ...data, revision: 0, updatedAt: new Date() }
    return memory
  })
  mocks.updateMemory.mockImplementation(async ({ where, data }) => {
    if (!memory || memory.revision !== where.revision) return { count: 0 }
    memory = { ...memory, ...data, revision: memory.revision + 1 }
    return { count: 1 }
  })
  mocks.findMemory.mockImplementation(async () => memory)
  mocks.usage.mockResolvedValue({})
  mocks.completion.mockResolvedValue({
    content: 'نیاز مشتری، تصمیم‌های قبلی و قدم بعدی', toolCalls: [],
    usage: { promptTokens: 120, completionTokens: 30, reasoningTokens: 0, cachedTokens: 0, costUSD: 0.001, providerRequestId: 'request' },
  })
})

afterEach(() => vi.useRealTimers())

function appendLong(count: number) {
  const start = rows.length
  append(count)
  for (const row of rows.slice(start)) row.content += ' customer requirement'.repeat(35)
}

function processedMessages(): string[] {
  return mocks.completion.mock.calls.flatMap(([opts]) => {
    const input = JSON.parse(opts.messages[1].content)
    return input.nextTranscript.trim().split('\n').map((line: string) => JSON.parse(line).text)
  })
}

describe('adaptive session memory', () => {
  it('finds a session boundary beyond a timestamp page without reading archived content', async () => {
    append(310)
    rows.slice(10).forEach((row) => { row.createdAt = new Date(row.createdAt.getTime() + 72 * 3600_000) })
    vi.setSystemTime(new Date(rows.at(-1)!.createdAt.getTime() + 60_000))
    const session = await loadConversationSession('thread')
    expect(session.start.id).toBe(rows[10].id)
    expect(session.restarted).toBe(true)
    expect(mocks.findMessages).toHaveBeenCalledTimes(2)
    for (const [query] of mocks.findMessages.mock.calls) expect(query.select).not.toHaveProperty('content')
  })
  it('keeps forty short messages intact without any summarization charge', async () => {
    append(40)
    const history = await loadConversationHistory('thread')
    expect(history.map((m) => m.content)).toEqual(rows.map((m) => m.content))
    expect(mocks.completion).not.toHaveBeenCalled()
  })

  it('creates headroom at the message safety cap instead of summarizing each new tiny message', async () => {
    append(64)
    await loadConversationHistory('thread')
    const calls = mocks.completion.mock.calls.length
    expect(calls).toBeGreaterThan(0)
    append(8)
    await loadConversationHistory('thread')
    expect(mocks.completion).toHaveBeenCalledTimes(calls)
  })

  it('compacts long messages by volume, preserving the latest dialogue and all older input', async () => {
    appendLong(100)
    const history = await loadConversationHistory('thread')
    const raw = history.filter((m) => !isConversationMemory(m))
    expect([...processedMessages(), ...raw.map((m) => m.content)]).toEqual(rows.map((r) => r.content))
    expect(raw.reduce((n, m) => n + estimateHistoryTokens(m.content ?? ''), 0)).toBeLessThan(HISTORY_TOKEN_BUDGET)
    expect(memory?.sessionStartId).toBe(rows[0].id)
    expect(history[0].content).not.toContain('operator summary')
    expect(mocks.usage).toHaveBeenCalledTimes(mocks.completion.mock.calls.length)
    const secondInput = JSON.parse(mocks.completion.mock.calls[1][0].messages[1].content)
    expect(secondInput.previousRecord).toContain('قدم بعدی')
  })

  it('reuses memory while below budget and processes only new overflow later', async () => {
    appendLong(20)
    await loadConversationHistory('thread')
    const calls = mocks.completion.mock.calls.length
    const oldCursor = memory?.throughId
    append(1)
    await loadConversationHistory('thread')
    expect(mocks.completion).toHaveBeenCalledTimes(calls)
    appendLong(20)
    mocks.completion.mockClear()
    await loadConversationHistory('thread')
    expect((memory?.throughId ?? '') > (oldCursor ?? '')).toBe(true)
    expect(processedMessages()).not.toContain(rows[0].content)
  })

  it('does not lose messages sharing a timestamp', async () => {
    appendLong(70)
    rows.forEach((row) => { row.createdAt = new Date('2026-01-01') })
    const history = await loadConversationHistory('thread')
    expect([...processedMessages(), ...history.filter((m) => m.role !== 'system').map((m) => m.content)])
      .toEqual(rows.map((row) => row.content))
  })

  it('excludes the current inbound and all later messages on retries, including timestamp ties', async () => {
    append(40)
    rows[20].inboundEventId = 'current-event'
    rows[21].createdAt = rows[20].createdAt
    const history = await loadConversationHistory('thread', 'current-event')
    expect(history.map((m) => m.content)).toEqual(rows.slice(0, 20).map((m) => m.content))
  })

  it('starts empty at exactly 48 hours, even before the new inbound is persisted', async () => {
    appendLong(20)
    await loadConversationHistory('thread')
    vi.setSystemTime(new Date(rows.at(-1)!.createdAt.getTime() + 48 * 3600_000))
    mocks.completion.mockClear()
    expect(await loadConversationHistory('thread')).toEqual([])
    expect(mocks.completion).not.toHaveBeenCalled()
  })

  it('retains context just below 48 hours', async () => {
    append(10)
    vi.setSystemTime(new Date(rows.at(-1)!.createdAt.getTime() + 48 * 3600_000 - 1))
    expect(await loadConversationHistory('thread')).toHaveLength(10)
  })

  it('ignores old memory and replaces it with a new session after a persisted return', async () => {
    appendLong(20)
    await loadConversationHistory('thread')
    const split = rows.length
    appendLong(24)
    rows.slice(split).forEach((row) => { row.createdAt = new Date(row.createdAt.getTime() + 72 * 3600_000) })
    vi.setSystemTime(new Date(rows.at(-1)!.createdAt.getTime() + 60_000))
    mocks.completion.mockClear()
    const history = await loadConversationHistory('thread')
    expect([...processedMessages(), ...history.filter((m) => m.role !== 'system').map((m) => m.content)])
      .toEqual(rows.slice(split).map((row) => row.content))
    expect(JSON.parse(mocks.completion.mock.calls[0][0].messages[1].content).previousRecord).toBe('')
    expect(memory?.sessionStartId).toBe(rows[split].id)
    expect(mocks.createMemory).toHaveBeenCalledTimes(1)
  })

  it('does not expose future memory or rewind it when an old webhook is retried', async () => {
    appendLong(20)
    rows[14].inboundEventId = 'old-event'
    await loadConversationHistory('thread')
    appendLong(24)
    rows.slice(20).forEach((row) => { row.createdAt = new Date(row.createdAt.getTime() + 72 * 3600_000) })
    vi.setSystemTime(new Date(rows.at(-1)!.createdAt.getTime() + 60_000))
    mocks.completion.mockResolvedValue({ content: 'FUTURE SESSION PRIVATE FACT', usage: { promptTokens: 10 } })
    await loadConversationHistory('thread')
    const saved = { ...memory }
    mocks.completion.mockClear()
    const retry = await loadConversationHistory('thread', 'old-event')
    expect(JSON.stringify(retry)).not.toContain('FUTURE SESSION PRIVATE FACT')
    expect(memory).toEqual(saved)
    expect(mocks.completion).not.toHaveBeenCalled()
  })

  it('does not let system activity bridge inactivity or enter the summary', async () => {
    append(2)
    rows.push({ ...rows[0], id: 'activity', role: 'SYSTEM', createdAt: new Date('2026-01-03T00:00:00Z'), content: 'system secret' })
    rows.push({ ...rows[0], id: 'return', role: 'USER', createdAt: new Date('2026-01-04T00:00:00Z'), content: 'new request' })
    vi.setSystemTime(new Date('2026-01-04T00:01:00Z'))
    expect(await loadConversationHistory('thread')).toEqual([{ role: 'user', content: 'new request' }])
  })

  it('keeps the saved cursor on failure, limits fallback context, and retries later', async () => {
    appendLong(20)
    await loadConversationHistory('thread')
    const previous = memory?.throughId
    appendLong(20)
    mocks.completion.mockRejectedValueOnce(new Error('provider down'))
    const failed = await loadConversationHistory('thread')
    expect(memory?.throughId).toBe(previous)
    expect(failed[0].content).toContain('have not been summarized yet')
    expect(failed.at(-1)?.content).toBe(rows.at(-1)?.content)
    expect(failed.filter((m) => m.role !== 'system').reduce((n, m) => n + estimateHistoryTokens(m.content ?? ''), 0)).toBeLessThanOrEqual(HISTORY_TOKEN_BUDGET)
    await loadConversationHistory('thread')
    expect(memory?.throughId).not.toBe(previous)
  })

  it.each(['key', 'budget'] as const)('answers without paid compaction when %s is unavailable', async (unavailable) => {
    appendLong(100)
    if (unavailable === 'key') mocks.key.mockReturnValue(null)
    else mocks.budget.mockResolvedValue(false)
    const history = await loadConversationHistory('thread')
    expect(mocks.completion).not.toHaveBeenCalled()
    expect(memory).toBeNull()
    expect(history[0].content).toContain('do not claim complete recall')
    expect(history.at(-1)?.content).toBe(rows.at(-1)?.content)
  })

  it('logs blank output cost without advancing the cursor', async () => {
    appendLong(20)
    mocks.completion.mockResolvedValueOnce({ content: '', usage: { promptTokens: 10, costUSD: 0.001 } })
    await loadConversationHistory('thread')
    expect(memory).toBeNull()
    expect(mocks.usage).toHaveBeenCalledTimes(1)
  })

  it('processes oversized historical messages to the end before saving their cursor', async () => {
    appendLong(20)
    rows[0].content = 'x'.repeat(26_000) + ' customer order FINAL-123'
    await loadConversationHistory('thread')
    expect(processedMessages().join('')).toContain('FINAL-123')
    expect(memory).not.toBeNull()
  })

  it('cannot overwrite a newer concurrent revision', async () => {
    appendLong(20)
    await loadConversationHistory('thread')
    const cursor = memory?.throughId
    appendLong(20)
    mocks.updateMemory.mockResolvedValueOnce({ count: 0 })
    await loadConversationHistory('thread')
    expect(memory?.throughId).toBe(cursor)
    expect(mocks.findMemory).toHaveBeenCalled()
  })

  it('keeps memory on catalog follow-ups but honors an explicit topic reset', async () => {
    appendLong(20)
    rows[18].content = 'محصولات رو نشون بده'
    const history = await loadConversationHistory('thread')
    const followup = historyForProductTurn(history, planProductRequest('و قیمتش؟', history))
    expect(isConversationMemory(followup[0])).toBe(true)
    expect(historyForProductTurn(history, planProductRequest('بیخیال از اول شروع کن', history))).toEqual([])
  })
})
