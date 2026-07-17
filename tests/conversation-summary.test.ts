import { describe, expect, it } from 'vitest'
import { buildFallbackSummary } from '@/lib/conversations/summary'

describe('conversation summaries', () => {
  it('does not infer dissatisfaction from an emoji-only Instagram comment', () => {
    const summary = buildFallbackSummary([
      {
        role: 'USER',
        content: '🔥',
        metadata: { vigentoInbound: { channel: 'INSTAGRAM', kind: 'COMMENT' } },
      },
      { role: 'ASSISTANT', content: 'ممنون از محبت شما' },
    ], 'fa')

    expect(summary).toContain('کامنت اینستاگرام')
    expect(summary).toContain('درخواست مشخص')
    expect(summary).not.toContain('ناراضی')
  })

  it('does not turn a greeting into a request for help', () => {
    const summary = buildFallbackSummary([
      {
        role: 'USER',
        content: 'سلام',
        metadata: { vigentoInbound: { channel: 'INSTAGRAM', kind: 'DM' } },
      },
      { role: 'ASSISTANT', content: 'سلام! چطور می‌توانم کمک کنم؟' },
    ], 'fa')

    expect(summary).toContain('دایرکت اینستاگرام')
    expect(summary).toContain('هنوز درخواست یا مشکلی مطرح نشده')
    expect(summary).not.toContain('درخواست کمک')
  })
})
