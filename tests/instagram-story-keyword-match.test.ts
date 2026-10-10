/**
 * Story scenarios must read the reply text.
 *
 * Bug: a scenario pinned to a picked story («کدام استوری‌ها؟») with «کلمات
 * خاص» fired on ANY reply to that story — the keywords were stored and shown
 * in the form but the engine never looked at them. A picked story now narrows
 * WHERE the reply came from and the keywords still decide WHAT it must say.
 *
 * The same matcher folds Persian spellings (Arabic ي/ك, ZWNJ, digits), so the
 * word the operator typed once matches the ways customers really type it.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ automationFindMany: vi.fn() }))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    instagramFollowGate: { findFirst: vi.fn().mockResolvedValue(null), findMany: vi.fn().mockResolvedValue([]) },
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
  sendRichEntry: vi.fn(),
  sendButtonMessage: vi.fn(),
  pickTemplateImageUrl: vi.fn(() => null),
}))
vi.mock('@/lib/instagram/config', () => ({
  readAutomationPolicy: vi.fn(() => null),
  readUserToken: vi.fn(() => 'token'),
  readPageToken: vi.fn(() => 'token'),
}))

import { normalizeMatchText, willInstagramAutomationHandle } from '@/lib/instagram/automation'
import type { InboundMessage } from '@/lib/channels/types'

const STORY_ID = '18131735425677048'

function storyScenario(trigger: Record<string, unknown>) {
  return {
    id: 'auto-1',
    agentId: 'agent-1',
    channelId: 'ig-channel-1',
    type: 'STORY',
    name: 'قیمت',
    active: true,
    priority: 0,
    trigger,
    action: { replyMode: 'STATIC', messages: [{ type: 'TEXT', text: 'سلام' }] },
  }
}

function storyReply(text: string, storyId = STORY_ID): InboundMessage {
  return {
    kind: 'STORY_REPLY',
    platformMessageId: 'mid.1',
    senderId: 'igsid-1',
    text,
    chatId: 'igsid-1',
    storyId,
  }
}

function handles(msg: InboundMessage) {
  return willInstagramAutomationHandle({ agentId: 'agent-1', channelId: 'ig-channel-1', msg })
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('story scenario pinned to a picked story', () => {
  const pinnedWithKeyword = {
    keywords: ['قیمت'],
    matchMode: 'CONTAINS',
    storyScope: 'SPECIFIC_STORY',
    storyIds: [STORY_ID],
    storyExpiresAt: new Date(Date.now() + 3_600_000).toISOString(),
  }

  it('runs when the reply to that story contains the keyword', async () => {
    mocks.automationFindMany.mockResolvedValue([storyScenario(pinnedWithKeyword)])
    expect(await handles(storyReply('قیمت این چنده؟'))).toBe(true)
  })

  it('does NOT run on an unrelated reply to the same story', async () => {
    mocks.automationFindMany.mockResolvedValue([storyScenario(pinnedWithKeyword)])
    expect(await handles(storyReply('چه قشنگ 😍'))).toBe(false)
  })

  it('does NOT run on the keyword under a different story', async () => {
    mocks.automationFindMany.mockResolvedValue([storyScenario(pinnedWithKeyword)])
    expect(await handles(storyReply('قیمت', 'another-story'))).toBe(false)
  })

  it('honours the match mode on the picked story', async () => {
    mocks.automationFindMany.mockResolvedValue([storyScenario({ ...pinnedWithKeyword, matchMode: 'EXACT' })])
    expect(await handles(storyReply('قیمت'))).toBe(true)
    expect(await handles(storyReply('قیمت این چنده؟'))).toBe(false)
  })

  it('still runs on every reply when «هر کلمه‌ای» is chosen (no keywords)', async () => {
    mocks.automationFindMany.mockResolvedValue([storyScenario({ ...pinnedWithKeyword, keywords: [] })])
    expect(await handles(storyReply('چه قشنگ 😍'))).toBe(true)
  })

  it('never runs once the picked story has expired', async () => {
    mocks.automationFindMany.mockResolvedValue([
      storyScenario({ ...pinnedWithKeyword, storyExpiresAt: new Date(Date.now() - 1000).toISOString() }),
    ])
    expect(await handles(storyReply('قیمت'))).toBe(false)
  })
})

describe('story scenario on every story', () => {
  it('reads the keyword for the KEYWORD scope and ignores text for ALL', async () => {
    mocks.automationFindMany.mockResolvedValue([
      storyScenario({ keywords: ['قیمت'], matchMode: 'CONTAINS', storyScope: 'KEYWORD' }),
    ])
    expect(await handles(storyReply('قیمت؟'))).toBe(true)
    expect(await handles(storyReply('سلام'))).toBe(false)

    mocks.automationFindMany.mockResolvedValue([
      storyScenario({ keywords: [], matchMode: 'CONTAINS', storyScope: 'ALL' }),
    ])
    expect(await handles(storyReply('سلام'))).toBe(true)
  })
})

describe('keyword spelling', () => {
  const keyword = (word: string, matchMode = 'CONTAINS') =>
    mocks.automationFindMany.mockResolvedValue([
      storyScenario({ keywords: [word], matchMode, storyScope: 'KEYWORD' }),
    ])

  it('matches the Arabic yeh/kaf spelling of a Persian keyword', async () => {
    keyword('قیمت کیف')
    expect(await handles(storyReply('قيمت كيف چنده'))).toBe(true)
  })

  it('matches a half-space word typed with a space, joined, or with ZWNJ', async () => {
    keyword('می‌خوام')
    expect(await handles(storyReply('می خوام'))).toBe(true)
    expect(await handles(storyReply('میخوام لطفا'))).toBe(true)
    expect(await handles(storyReply('می‌خوام'))).toBe(true)
  })

  it('matches Persian digits against Latin ones', async () => {
    keyword('کد 10', 'EXACT')
    expect(await handles(storyReply('کد ۱۰'))).toBe(true)
  })

  it('does not let a short keyword match across a word break', async () => {
    keyword('کد')
    expect(await handles(storyReply('تک دونه'))).toBe(false)
    expect(await handles(storyReply('کد تخفیف'))).toBe(true)
  })

  it('keeps emoji keywords working', async () => {
    keyword('🔥')
    expect(await handles(storyReply('🔥🔥'))).toBe(true)
    expect(normalizeMatchText(' 🔥 ')).toBe('🔥')
  })
})
