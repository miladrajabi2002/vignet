import { describe, expect, it } from 'vitest'
import { inboundSourceTag } from '@/lib/conversations/source'

describe('inboundSourceTag', () => {
  const comment = { channel: 'INSTAGRAM', kind: 'COMMENT' } as const

  it('tags a comment thread as a comment', () => {
    expect(inboundSourceTag(comment, 'comment:18090004787673532')).toBe('Instagram Comment')
  })

  it('tags a comment answered in Direct as Direct', () => {
    expect(inboundSourceTag(comment, '27559774387035497')).toBe('Instagram Direct')
  })

  it('keeps the message kind when the thread is unknown', () => {
    expect(inboundSourceTag(comment)).toBe('Instagram Comment')
    expect(inboundSourceTag({ channel: 'INSTAGRAM', kind: 'STORY_REPLY' }, '27559774387035497')).toBe('Instagram Story')
  })
})
