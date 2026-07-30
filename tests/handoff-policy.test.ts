import { describe, expect, it } from 'vitest'
import { analyzeSalesConversation } from '@/lib/ai/sales-intelligence'
import {
  evaluateHandoffPolicy,
  shouldActivateHandoff,
} from '@/lib/ai/handoff'

function decisionFor(
  messages: Array<{
    role: 'USER' | 'ASSISTANT'
    content: string
    unanswered?: boolean
  }>,
  messageCount = messages.length,
) {
  const analysis = analyzeSalesConversation({
    messages,
    businessType: 'SUPPORT',
    language: 'fa',
  })
  return evaluateHandoffPolicy({
    analysis,
    businessType: 'SUPPORT',
    language: 'fa',
    messageCount,
  })
}

describe('smart handoff activation', () => {
  it('always honors an explicit request for a human even for a legacy disabled agent', () => {
    const decision = decisionFor([
      { role: 'USER', content: 'لطفاً من را به یک اپراتور انسانی وصل کنید' },
    ])

    expect(decision.reasonCodes).toContain('EXPLICIT_REQUEST')
    expect(shouldActivateHandoff(decision, false)).toBe(true)
  })

  it('hands off after repeated unanswered replies without waiting for the customer to ask', () => {
    const decision = decisionFor([
      { role: 'USER', content: 'وضعیت درخواست من چیست؟' },
      { role: 'ASSISTANT', content: 'اطلاعات کافی ندارم', unanswered: true },
      { role: 'USER', content: 'لطفاً دوباره بررسی کن' },
      { role: 'ASSISTANT', content: 'هنوز اطلاعات کافی ندارم', unanswered: true },
      { role: 'USER', content: 'نتیجه چه شد؟' },
      { role: 'ASSISTANT', content: 'پاسخی پیدا نکردم', unanswered: true },
      { role: 'USER', content: 'این موضوع را پیگیری کن' },
    ])

    expect(decision.reasonCodes).toContain('UNANSWERED')
    expect(shouldActivateHandoff(decision, false)).toBe(true)
  })

  it('uses the proactive setting for authority/friction recommendations', () => {
    const decision = decisionFor([
      { role: 'USER', content: 'برای فاکتور رسمی و شرایط اختصاصی باید با چه کسی هماهنگ کنم؟' },
    ], 4)

    expect(decision.reasonCodes).toContain('NEGOTIATION_AUTHORITY')
    expect(shouldActivateHandoff(decision, false)).toBe(false)
    expect(shouldActivateHandoff(decision, true)).toBe(true)
  })

  it('does not transfer a long but healthy information conversation', () => {
    const decision = decisionFor([
      { role: 'USER', content: 'فقط مشخصات محصول را می‌خواهم' },
    ], 30)

    expect(decision.recommended).toBe(false)
    expect(shouldActivateHandoff(decision, true)).toBe(false)
  })
})
