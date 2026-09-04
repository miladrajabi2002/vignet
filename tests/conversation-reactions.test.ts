import { describe, expect, it } from 'vitest'
import { presentConversationMessages } from '@/lib/conversations/reactions'

const message = (
  id: string,
  role: 'USER' | 'ASSISTANT' | 'SYSTEM',
  content: string,
  metadata: unknown = null,
) => ({ id, role, content, metadata, createdAt: `2026-09-04T12:00:0${id.length}.000Z` })

describe('conversation reaction presentation', () => {
  it('hides a legacy reaction row and attaches it to its exact message', () => {
    const target = message('target', 'USER', 'سلام', {
      vigentoInbound: { channel: 'INSTAGRAM', kind: 'DM', platformMessageId: 'mid.1' },
    })
    const reaction = message('reaction', 'USER', '❤️', {
      vigentoInbound: { channel: 'INSTAGRAM', kind: 'REACTION', platformMessageId: 'mid.1' },
    })

    const result = presentConversationMessages([target, reaction])

    expect(result.messages).toEqual([target])
    expect(result.reactionsByMessageId.get(target.id)).toEqual([
      expect.objectContaining({ id: 'reaction', emoji: '❤️' }),
    ])
  })

  it('falls back to the latest assistant message for old outbound ids', () => {
    const assistant = message('assistant', 'ASSISTANT', 'خواهش می‌کنم')
    const laterUser = message('user', 'USER', 'ممنون')
    const reaction = message('reaction', 'USER', '🔥', {
      vigentoInbound: { channel: 'INSTAGRAM', kind: 'REACTION', platformMessageId: 'unknown.outbound.mid' },
    })

    const result = presentConversationMessages([assistant, laterUser, reaction])

    expect(result.reactionsByMessageId.get(assistant.id)?.[0].emoji).toBe('🔥')
    expect(result.reactionsByMessageId.has(laterUser.id)).toBe(false)
  })

  it('reads reactions already embedded on a target message', () => {
    const target = message('target', 'ASSISTANT', 'Hello', {
      vigentoReactions: [{ id: 'event.1', emoji: '💙', createdAt: '2026-09-04T12:00:00.000Z' }],
    })

    const result = presentConversationMessages([target])

    expect(result.messages).toEqual([target])
    expect(result.reactionsByMessageId.get(target.id)?.[0].emoji).toBe('💙')
  })
})
