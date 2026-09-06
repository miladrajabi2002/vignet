import { describe, expect, it } from 'vitest'
import { closingReplyText } from '@/lib/ai/response-policy'
import type { ChatMessage } from '@/lib/ai/openrouter'

const answered: ChatMessage[] = [
  { role: 'user', content: 'هزینه ارسال چقدره؟' },
  { role: 'assistant', content: '۱۲۸ هزار تومان.' },
]

describe('closing without another AI turn', () => {
  it.each(['ممنون', 'مرسی عزیزم 🌹', 'ممنون، فعلاً کاری ندارم', 'نه مرسی', 'نه ممنون', 'خداحافظ', 'فعلاً باید فکر کنم', 'بعداً تصمیم می‌گیرم', 'Thanks, that is all.', 'No thanks', 'I need to think'])(
    'acknowledges a complete closing: %s', (message) => {
      const reply = closingReplyText(message, answered, 'fa')
      expect(reply).not.toBeNull()
      expect(reply).not.toMatch(/[؟?]/)
      expect(reply!.length).toBeLessThan(60)
    },
  )

  it.each(['بله', 'آره', 'باشه', 'نه', 'ممنون؟', 'ممنون، هزینه ارسال چقدره؟', 'نه مرسی، مشکی رو بفرست', 'بعداً تماس بگیرید', 'خداحافظی نکن، سفارش رو پیگیری کن', 'Thanks, send the link', 'No thanks, cancel my booking', 'ممنون ولی اشتباهه', '', '🙏'])(
    'preserves requests, corrections and answers to pending questions: %s', (message) => {
      expect(closingReplyText(message, answered, 'fa')).toBeNull()
    },
  )

  it('does not lose an unanswered preceding message in a rapid message batch', () => {
    expect(closingReplyText('ممنون', [...answered, { role: 'user', content: 'لینک خرید رو هم بفرست' }], 'fa')).toBeNull()
  })

  it('uses the configured language and distinguishes declining from thanks', () => {
    expect(closingReplyText('نه ممنون', answered, 'fa')).toBe('حتماً.')
    expect(closingReplyText('Thanks', answered, 'en')).toBe('You’re welcome.')
    expect(closingReplyText('خداحافظ', answered, 'en')).toBe('Goodbye.')
  })
})
