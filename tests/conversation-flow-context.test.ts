import { describe, expect, it } from 'vitest'
import { conversationFlowInstruction } from '@/lib/agent-kernel/skills/conversation-flow'

describe('conversation reference policy', () => {
  const history = [
    { role: 'user' as const, content: 'جلومبلی نقش بهتره یا نگار؟' },
    { role: 'assistant' as const, content: 'برای فضای کوچک نقش بهتر است.' },
  ]

  it('orders the model to resolve a clear reference instead of re-asking', () => {
    const instruction = conversationFlowInstruction({
      isFa: true,
      history,
      userMessage: 'کدومش ارزون‌تره؟',
    })
    expect(instruction).toContain('دوباره نام گزینه‌ها را نپرس')
    expect(instruction).toContain('محصول یا موضوع سومی')
  })

  it('keeps the newest criterion in focus', () => {
    const instruction = conversationFlowInstruction({
      isFa: true,
      history,
      userMessage: 'حالا کیفیتشون چطوره؟',
    })
    expect(instruction).toContain('معیار سؤال فعلی')
    expect(instruction).toContain('درخواست‌های پاسخ‌داده‌شده را دوباره جواب نده')
  })
})
