import { describe, expect, it } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { conversationSessionBoundaries, currentSessionMessages } from '@/lib/conversations/session'
import { ConversationSessionDivider } from '@/components/crm/conversation-session-divider'

const message = (id: string, role: string, createdAt: string) => ({ id, role, createdAt })

describe('conversation session boundaries shared by both inboxes', () => {
  it('marks the first returning customer message, ignoring intervening system events', () => {
    const messages = [
      message('old-user', 'USER', '2026-01-01T00:00:00Z'),
      message('old-reply', 'ASSISTANT', '2026-01-01T01:00:00Z'),
      message('system', 'SYSTEM', '2026-01-03T00:30:00Z'),
      message('return', 'USER', '2026-01-03T01:00:00Z'),
      message('reply', 'ASSISTANT', '2026-01-03T01:01:00Z'),
    ]
    expect([...conversationSessionBoundaries(messages)]).toEqual(['return'])
    expect(currentSessionMessages(messages).map((m) => m.id)).toEqual(['return', 'reply'])
  })

  it('does not start a new session for an operator follow-up or a sub-48-hour customer gap', () => {
    const messages = [
      message('first', 'USER', '2026-01-01T00:00:00Z'),
      message('operator', 'ASSISTANT', '2026-01-04T00:00:00Z'),
      message('customer', 'USER', '2026-01-05T23:59:59Z'),
    ]
    expect(conversationSessionBoundaries(messages).size).toBe(0)
    expect(currentSessionMessages(messages)).toEqual(messages)
  })

  it('retains all archived messages and locates multiple returns for timeline dividers', () => {
    const messages = [
      message('first', 'USER', '2026-01-01T00:00:00Z'),
      message('second', 'USER', '2026-01-04T00:00:00Z'),
      message('third', 'USER', '2026-01-07T00:00:00Z'),
    ]
    expect([...conversationSessionBoundaries(messages)]).toEqual(['second', 'third'])
    expect(currentSessionMessages(messages).map((m) => m.id)).toEqual(['third'])
    expect(messages).toHaveLength(3)
  })

  it.each(['fa', 'en'] as const)('renders an explicit context boundary in %s', (locale) => {
    const html = renderToStaticMarkup(createElement(ConversationSessionDivider, { locale }))
    expect(html).toContain('role="note"')
    expect(html).toContain(locale === 'fa' ? 'dir="rtl"' : 'dir="ltr"')
    expect(html).toContain(locale === 'fa' ? 'قبل از این مرز در پاسخ ایجنت استفاده نمی‌شوند' : 'excludes messages and summaries before this point')
  })
})
