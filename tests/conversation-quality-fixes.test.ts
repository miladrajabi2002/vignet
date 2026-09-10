import { describe, expect, it } from 'vitest'
import type { ChatMessage } from '@/lib/ai/openrouter'
import { historyForProductTurn, planProductRequest } from '@/lib/ai/conversation'
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

describe('conversation quality fixes — shipping policy routing', () => {
  it.each([
    'فروشگاه قبول ميكنه با اسنپ هم ارسال كنه؟',
    'نه من ماشين بگيرم و با ماشين برام ارسال كنن',
    'قسط ها تموم شد لباس رو ارسال میکنید؟',
    'امروز جمعه هست با تیپاکس هم میشه بفرستین که زود برسه',
    'فقط با تيپاكس و پست ميفرستيد؟',
    'نحوه ارسال چطوره؟',
    'با پست هم میفرستید؟',
  ])('keeps shipping questions out of the catalog showcase: %s', (message) => {
    const plan = planProductRequest(message, [])
    expect(plan.isProductTurn).toBe(false)
    expect(plan.explicitShowcase).toBe(false)
  })

  it.each([
    'شومیز',
    'دنبال یه شومیز مجلسی هستم',
    'بلوز دارید؟',
    'دامن کار رو هم موجود دارید',
    'تونیک روناز 0788',
    'مانتو کاپشن دارید؟',
  ])('treats garment nouns as catalog intent: %s', (message) => {
    expect(planProductRequest(message, []).isProductTurn).toBe(true)
  })

  it('searches for the bare garment term itself', () => {
    expect(planProductRequest('شومیز', []).searchTerms).toContain('شومیز')
  })

  it.each([
    'کاتالوگ رو بفرست',
    'قیمت ها رو بفرست',
    'عکس محصولات رو ارسال کنید',
    'همه رو بفرست',
    '۵ تا رو بفرست',
  ])('still treats an explicit showcase demand as a showcase: %s', (message) => {
    const plan = planProductRequest(message, [user('چی دارید؟'), assistant('لباس مجلسی داریم.')])
    // A strong shipping signal must never suppress a real showcase demand
    // about catalog objects (کاتالوگ/قیمت/عکس/مدل/…).
    expect(plan.explicitShowcase).toBe(true)
  })

  it.each([
    'پیراهن وارداتی شنل رنگ صورتی',
    'پستتون قشنگ بود',
  ])('small talk and product statements are not showcases: %s', (message) => {
    const plan = planProductRequest(message, [user('چی دارید؟'), assistant('لباس مجلسی داریم.')])
    expect(plan.explicitShowcase).toBe(false)
  })
})

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
    expect(guarded).toContain('امکان ثبت یا نهایی‌کردن سفارش داخل این گفتگو فعال نیست')
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

describe('conversation quality fixes — history integrity', () => {
  it('keeps history intact for shipping policy turns (no showcase boundary)', () => {
    const history = [
      user('سلام'),
      assistant('سلام! چطور می‌تونم کمکتون کنم؟'),
      user('فروشگاه قبول ميكنه با اسنپ هم ارسال كنه؟'),
    ]
    const plan = planProductRequest(history[2].content ?? '', history.slice(0, 2))
    expect(historyForProductTurn(history.slice(0, 2), plan)).toEqual(history.slice(0, 2))
  })
})
