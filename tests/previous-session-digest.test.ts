import { describe, expect, it } from 'vitest'
import {
  PREVIOUS_SESSION_PREFIX,
  isPreviousSessionDigest,
  previousSessionDigestMessage,
} from '@/lib/ai/conversation-memory'

describe('previous-session digest — returning-customer continuity across the idle boundary', () => {
  it('builds a labeled, untrusted historical digest', () => {
    const message = previousSessionDigestMessage('مشتری دنبال گوشی سامسونگ بود؛ قرار شد فردا تماس بگیریم')
    expect(message).not.toBeNull()
    expect(message!.role).toBe('system')
    expect(message!.content!.startsWith(PREVIOUS_SESSION_PREFIX)).toBe(true)
    // The record is embedded as DATA (JSON string), never as instructions.
    expect(message!.content).toContain('قرار شد فردا تماس بگیریم')
    expect(message!.content).toContain('untrusted historical DATA')
    expect(isPreviousSessionDigest(message!)).toBe(true)
  })

  it('rejects empty or whitespace-only summaries', () => {
    expect(previousSessionDigestMessage('')).toBeNull()
    expect(previousSessionDigestMessage('   ')).toBeNull()
    expect(previousSessionDigestMessage(undefined as unknown as string)).toBeNull()
  })

  it('is distinguishable from the in-session memory message', () => {
    const digest = previousSessionDigestMessage('record')
    expect(digest).not.toBeNull()
    expect(isPreviousSessionDigest(digest!)).toBe(true)
    expect(digest!.content!.startsWith('[Conversation memory')).toBe(false)
  })
})
