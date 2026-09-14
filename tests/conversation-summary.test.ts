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

  it('summarizes multiple recent needs and makes the unresolved state explicit without AI', () => {
    const summary = buildFallbackSummary([
      { role: 'USER', content: 'جلومبلی نقش و نگار رو مقایسه کن' },
      { role: 'ASSISTANT', content: 'نقش برای پذیرایی کوچک جمع‌وجورتر است.' },
      { role: 'USER', content: 'کدومش ارزون‌تره؟' },
    ], 'fa')

    expect(summary).toContain('جلومبلی نقش و نگار')
    expect(summary).toContain('کدومش ارزون‌تره')
    expect(summary).toContain('نیازمند پاسخ اپراتور')
  })

  it('reuses rolling memory as relevant history in the operator summary', () => {
    const summary = buildFallbackSummary([
      { role: 'USER', content: 'کیفیتشون چطوره؟' },
      { role: 'ASSISTANT', content: 'کیفیت هر دو در کاتالوگ درجه یک ثبت شده است.' },
    ], 'fa', 'هدف مشتری: مقایسه جلومبلی نقش و نگار برای پذیرایی کوچک')

    expect(summary).toContain('سابقه مرتبط')
    expect(summary).toContain('نقش و نگار')
    expect(summary).toContain('آخرین پاسخ ایجنت')
  })
})
