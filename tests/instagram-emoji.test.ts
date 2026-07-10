import { describe, expect, it } from 'vitest'
import { isEmojiOnly } from '@/lib/instagram/emoji'

describe('isEmojiOnly', () => {
  it.each(['🔥', '🔥 ❤️', '👍🏽', '👨‍👩‍👧‍👦', '🇮🇷', '1️⃣', '☕️'])('accepts %s', (value) => {
    expect(isEmojiOnly(value)).toBe(true)
  })

  it.each(['', 'hello', '🔥 عالیه', '123', '#', 'سلام ❤️'])('rejects %s', (value) => {
    expect(isEmojiOnly(value)).toBe(false)
  })
})
