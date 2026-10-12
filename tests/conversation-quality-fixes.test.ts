import { describe, expect, it } from 'vitest'
import type { ChatMessage } from '@/lib/ai/openrouter'
import { buildTurnReceipts } from '@/lib/conversations/activity'
import {
  enforceActionCapabilities,
  isUnsupportedOrderCreationRequest,
} from '@/lib/agent-kernel/skills/action-capabilities'
import {
  enforceVisualReferenceGrounding,
  needsVisualReferenceSkill,
} from '@/lib/agent-kernel/skills/visual-reference'
import { compileAgentSkillPlan } from '@/lib/agent-kernel/registry'

const user = (content: string): ChatMessage => ({ role: 'user', content })
const assistant = (content: string): ChatMessage => ({ role: 'assistant', content })

describe('conversation quality fixes — action capability guard', () => {
  it('detects an in-chat order creation request', () => {
    expect(isUnsupportedOrderCreationRequest('سلام عزیزم خوبین میشه از همینجا خرید کنم باسایت نمیتونم')).toBe(true)
    expect(isUnsupportedOrderCreationRequest('میشه اینجا سفارش ثبت کنم؟')).toBe(true)
    expect(isUnsupportedOrderCreationRequest('برام ثبت سفارش انجام میدی؟')).toBe(true)
  })

  it('does not treat read-only order tracking as order creation', () => {
    expect(isUnsupportedOrderCreationRequest('سفارشم کجاست؟ وضعیت سفارش رو بگو')).toBe(false)
    expect(isUnsupportedOrderCreationRequest('شماره سفارش ۱۲۳۴ رو پیگیری کن')).toBe(false)
  })

  it('replaces a checkout promise with the honest unavailable reply', () => {
    const guarded = enforceActionCapabilities({
      reply: 'سلام. بله، می‌تونید از همین طریق خرید کنید. محصول مورد نظرتون رو بگید تا موجودی و قیمت رو چک کنم و مراحل رو براتون توضیح بدم',
      userMessage: 'میشه از همینجا خرید کنم؟ سایت برام باز نمیشه',
      isFa: true,
    })
    expect(guarded).toContain('ثبت سفارش از داخل همین چت فعلاً برای من فعال نیست')
    expect(guarded).not.toContain('می‌تونید از همین طریق خرید کنید')
  })

  it('keeps grounded product facts in a normal reply', () => {
    const reply = 'ست بلوز شلوار میو یقه دار 0537 موجوده. قیمتش ۱,۸۴۷,۰۰۰ تومان و سایزش فری هست.'
    expect(enforceActionCapabilities({ reply, userMessage: 'بلوز دارید؟', isFa: true })).toBe(reply)
  })
})

describe('conversation quality fixes — visual reference grounding', () => {
  it('recognizes references to media the store itself sent', () => {
    expect(needsVisualReferenceSkill({ userMessage: 'دامنش که عکس گذاشتین موجوده' })).toBe(true)
    expect(needsVisualReferenceSkill({ userMessage: 'منظورم این مدل و رنگه' })).toBe(true)
    expect(needsVisualReferenceSkill({ userMessage: 'همون عکس قبلی' })).toBe(true)
    expect(needsVisualReferenceSkill({ userMessage: 'سلام چی دارید؟' })).toBe(false)
  })

  it('replaces the blind-photo claim when the customer referred to the store card', () => {
    const guarded = enforceVisualReferenceGrounding({
      reply: 'متأسفانه نمی‌توانم عکس را ببینم. لطفاً رنگ یا نام دقیق دامنی که مد نظرتونه رو بگید تا موجودی و قیمت را براتون چک کنم',
      userMessage: 'دامنش که عکس گذاشتین موجوده',
      isFa: true,
    })
    expect(guarded).not.toContain('نمی‌توانم عکس را ببینم')
    expect(guarded).toContain('کارتش را در همین گفتگو فرستادیم')
  })

  it('keeps the honest blind claim when the customer claims to have sent media we never received', () => {
    const reply = 'متأسفانه نمی‌توانم عکس را ببینم. لطفاً دوباره بفرستید'
    expect(enforceVisualReferenceGrounding({
      reply,
      userMessage: 'عکس رو فرستادم ببینید',
      isFa: true,
    })).toBe(reply)
  })

  it('keeps the reply when verified channel media exists on the turn', () => {
    const reply = 'پیام صوتی شما دریافت شد اما محتوایش را نمی‌توانم ببینم'
    expect(enforceVisualReferenceGrounding({
      reply,
      userMessage: 'این مدل',
      inboundMediaKind: 'photo',
      isFa: true,
    })).toBe(reply)
  })
})

describe('conversation quality fixes — receipts', () => {
  const productChunk = { metadata: { productId: 'p1' } }
  const productChunk2 = { metadata: { productId: 'p2' } }
  const knowledgeChunk = { metadata: { source: 'policy' } }

  it('counts product chunks only once, as catalog rows', () => {
    const receipts = buildTurnReceipts({
      userMessage: 'شومیز',
      assistantReply: 'این مدل موجود است.',
      retrievedChunks: [knowledgeChunk, productChunk, productChunk2],
    })
    const knowledge = receipts.find((r) => r.kind === 'knowledge_used')
    const catalog = receipts.find((r) => r.kind === 'catalog_checked')
    expect(knowledge?.count).toBe(1)
    expect(catalog?.count).toBe(2)
  })

  it('a provider-failure fallback claims no knowledge/catalog usage', () => {
    const receipts = buildTurnReceipts(
      {
        userMessage: 'سایز ۳۶ مدیوم',
        assistantReply: 'یه مشکل فنی پیش اومده، لطفاً چند لحظه بعد دوباره پیام بده',
        retrievedChunks: Array.from({ length: 12 }, () => productChunk),
      },
      { serviceError: true },
    )
    expect(receipts).toEqual([{ kind: 'model_error' }])
    expect(receipts.some((r) => r.kind === 'knowledge_used')).toBe(false)
    expect(receipts.some((r) => r.kind === 'catalog_checked')).toBe(false)
  })
})

describe('conversation quality fixes — kernel skill activation', () => {
  it('always activates the capability boundary skill', () => {
    const plan = compileAgentSkillPlan({
      language: 'fa',
      userMessage: 'سلام',
      history: [],
      hasKnowledgeContext: false,
    })
    expect(plan.active.some((s) => s.key === 'action-capability-boundaries')).toBe(true)
    expect(plan.instructions.capabilities.length).toBeGreaterThan(20)
  })

  it('activates the visual reference skill on an outbound photo reference', () => {
    const plan = compileAgentSkillPlan({
      language: 'fa',
      userMessage: 'دامنش که عکس گذاشتین موجوده',
      history: [],
      hasKnowledgeContext: true,
    })
    expect(plan.active.some((s) => s.key === 'visual-reference-grounding')).toBe(true)
    expect(plan.instructions.visualReference).toContain('کارت')
  })

  it('activates the visual reference skill on verified channel media', () => {
    const plan = compileAgentSkillPlan({
      language: 'fa',
      userMessage: '',
      history: [],
      inboundMediaKind: 'photo',
      hasKnowledgeContext: false,
    })
    expect(plan.active.some((s) => s.key === 'visual-reference-grounding')).toBe(true)
    expect(plan.instructions.visualReference).toContain('photo')
  })
})
