import { describe, expect, it } from 'vitest'
import {
  analyzeSalesConversation,
  normalizeSalesText,
  salesGuidanceForModel,
} from '@/lib/ai/sales-intelligence'
import { evaluateHandoffPolicy, handoffReplyText } from '@/lib/ai/handoff'

describe('sales conversation intelligence', () => {
  it('recognizes a Persian buyer who is ready to transact', () => {
    const analysis = analyzeSalesConversation({
      businessType: 'COMMERCE',
      language: 'fa',
      messages: [
        { role: 'USER', content: 'این مدل موجوده؟ هزینه ارسالش چقدره؟' },
        { role: 'ASSISTANT', content: 'بله موجود است.' },
        { role: 'USER', content: 'عالیه، میخوام بخرم؛ لینک پرداخت رو بفرستید' },
      ],
    })

    expect(analysis.leadType).toBe('BUYER')
    expect(analysis.stage).toBe('PURCHASE_INTENT')
    expect(analysis.buyerProbability).toBeGreaterThanOrEqual(70)
    expect(analysis.buyerReadiness).toBe('HOT')
    expect(analysis.signalCodes).toContain('BUY_COMMITMENT')
    expect(analysis.evidence[0]).toHaveProperty('excerpt')
  })

  it('distinguishes an English information seeker from a buyer', () => {
    const analysis = analyzeSalesConversation({
      businessType: 'SERVICES',
      language: 'en',
      messages: [
        { role: 'USER', content: 'I am just researching and not ready to buy. Can you send details?' },
      ],
    })

    expect(analysis.leadType).toBe('INFORMATION_SEEKER')
    expect(analysis.stage).toBe('INFORMATION_GATHERING')
    expect(analysis.buyerProbability).toBeLessThanOrEqual(18)
    expect(analysis.explanation).toContain('conversion probability')
  })

  it('identifies an existing customer instead of treating support as a new lead', () => {
    const analysis = analyzeSalesConversation({
      businessType: 'COMMERCE',
      messages: [
        { role: 'USER', content: 'من دیروز خریدم؛ کد رهگیری سفارش من هنوز نیومده' },
      ],
    })

    expect(analysis.leadType).toBe('EXISTING_CUSTOMER')
    expect(analysis.stage).toBe('POST_PURCHASE')
    expect(analysis.buyerReadiness).toBe('CUSTOMER')
    expect(analysis.buyerProbability).toBe(100)
  })

  it('applies vertical risk vocabulary without psychographic inference', () => {
    const analysis = analyzeSalesConversation({
      businessType: 'FOOD',
      messages: [
        { role: 'USER', content: 'حساسیت غذایی شدید دارم و الان بعد از غذا نفس نمیکشم' },
      ],
    })

    expect(analysis.riskFlags).toContain('ALLERGY')
    expect(analysis.urgency).toBe('HIGH')
    expect(analysis.recommendedAction).toContain('اپراتور')
  })

  it('normalizes Arabic/Persian characters and digits consistently', () => {
    expect(normalizeSalesText('كیفیت ۱۲۳')).toBe('کیفیت 123')
  })

  it('turns the reading into low-pressure internal guidance for the same model call', () => {
    const analysis = analyzeSalesConversation({
      messages: [{ role: 'USER', content: 'فعلاً فقط اطلاعات می‌خوام و قصد خرید ندارم' }],
    })
    const guidance = salesGuidanceForModel(analysis, 'fa')

    expect(guidance).toContain('راهنمای داخلی فروش')
    expect(guidance).toContain('حداکثر یک سؤال')
    expect(guidance).toContain('از فشار')
  })

  it('detects repeated unresolved requests and consecutive failures', () => {
    const analysis = analyzeSalesConversation({
      businessType: 'SUPPORT',
      messages: [
        { role: 'USER', content: 'چرا پرداخت من ثبت نشده؟' },
        { role: 'ASSISTANT', content: 'اطلاعاتم کامل نیست', unanswered: true },
        { role: 'USER', content: 'لطفا بگید چرا پرداخت من ثبت نشده' },
        { role: 'ASSISTANT', content: 'اطلاعاتم کامل نیست', unanswered: true },
        { role: 'USER', content: 'باز هم میپرسم چرا پرداخت من ثبت نشده؟' },
      ],
    })

    expect(analysis.operational.repeatedRequest).toBe(true)
    expect(analysis.operational.consecutiveUnanswered).toBe(2)
  })
})

describe('smart operator handoff policy', () => {
  it('honors an explicit request for a human immediately', () => {
    const analysis = analyzeSalesConversation({
      businessType: 'SERVICES',
      messages: [{ role: 'USER', content: 'لطفا من را به اپراتور وصل کنید' }],
    })
    const decision = evaluateHandoffPolicy({
      analysis,
      businessType: 'SERVICES',
      messageCount: 1,
    })

    expect(decision.handoff).toBe(true)
    expect(decision.code).toBe('EXPLICIT_REQUEST')
    expect(decision.priority).toBe('high')
  })

  it('does not hand off a healthy information conversation for length alone', () => {
    const analysis = analyzeSalesConversation({
      businessType: 'EDUCATION',
      messages: [{ role: 'USER', content: 'فقط اطلاعات دوره و سرفصل‌ها رو میخوام' }],
    })
    const decision = evaluateHandoffPolicy({
      analysis,
      businessType: 'EDUCATION',
      messageCount: 40,
    })

    expect(decision.handoff).toBe(false)
    expect(decision.reasonCodes).toEqual([])
  })

  it('hands off repeated failures while preserving explainable reason codes', () => {
    const analysis = analyzeSalesConversation({
      businessType: 'SUPPORT',
      messages: [
        { role: 'USER', content: 'چرا حسابم باز نمیشه؟' },
        { role: 'ASSISTANT', content: 'نمیدانم', unanswered: true },
        { role: 'USER', content: 'چرا حسابم باز نمیشه؟' },
        { role: 'ASSISTANT', content: 'نمیدانم', unanswered: true },
        { role: 'USER', content: 'برای بار سوم چرا حسابم باز نمیشه؟' },
      ],
    })
    const decision = evaluateHandoffPolicy({
      analysis,
      businessType: 'SUPPORT',
      messageCount: 5,
    })

    expect(decision.handoff).toBe(true)
    expect(decision.reasonCodes).toEqual(expect.arrayContaining(['UNANSWERED', 'REPEATED_REQUEST']))
  })

  it('routes negotiation only when the customer needs human authority', () => {
    const analysis = analyzeSalesConversation({
      businessType: 'COMMERCE',
      messages: [
        { role: 'USER', content: 'برای قرارداد عمده، قیمت همکاری و تایید مدیر فروش رو میخوام' },
      ],
    })
    const decision = evaluateHandoffPolicy({
      analysis,
      businessType: 'COMMERCE',
      messageCount: 1,
    })

    expect(analysis.operational.requiresHumanAuthority).toBe(true)
    expect(decision.handoff).toBe(true)
    expect(decision.code).toBe('NEGOTIATION_AUTHORITY')
  })

  it('treats vertical safety signals as urgent hard triggers', () => {
    const analysis = analyzeSalesConversation({
      businessType: 'APPOINTMENTS',
      messages: [{ role: 'USER', content: 'خونریزی شدید دارم و فوری وقت میخوام' }],
    })
    const decision = evaluateHandoffPolicy({
      analysis,
      businessType: 'APPOINTMENTS',
      messageCount: 1,
    })

    expect(decision.handoff).toBe(true)
    expect(decision.code).toBe('HIGH_RISK')
    expect(decision.priority).toBe('urgent')
  })

  it('uses a natural no-repeat handoff message in the agent language', () => {
    const text = handoffReplyText(
      {
        handoff: true,
        recommended: true,
        code: 'EXPLICIT_REQUEST',
        reasonCodes: ['EXPLICIT_REQUEST'],
        reason: 'explicit request',
        score: 10,
        priority: 'high',
      },
      { language: 'en', handoffMessage: null } as never,
    )

    expect(text).toContain('human specialist')
    expect(text).toContain('repeat')
  })
})
