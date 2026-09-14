import { describe, expect, it } from 'vitest'
import { buildMessages } from '@/lib/ai/rag'
import { agentSkillTrace, hasAgentSkill } from '@/lib/agent-kernel/contracts'
import { AGENT_KERNEL_VERSION, AGENT_SKILL_MANIFESTS, compileAgentSkillPlan } from '@/lib/agent-kernel/registry'
import { runAgentSkillPostprocessors } from '@/lib/agent-kernel/postprocess'
import { enforceActionCapabilities, safeOrderUrl } from '@/lib/agent-kernel/skills/action-capabilities'

describe('internal agent skill kernel', () => {
  it('activates deterministic policy, context, action and postprocess skills per turn', () => {
    const plan = compileAgentSkillPlan({
      language: 'fa',
      userMessage: 'قیمت محصول و وقت رزرو فردا را بررسی کن',
      history: [],
      hasKnowledgeContext: true,
      productTurn: true,
      catalogAccessEnabled: true,
      orderTurn: false,
      bookingTurn: true,
      handoffEnabled: true,
      salesIntelligenceEnabled: true,
      richProductCards: true,
    })

    expect(plan.kernelVersion).toBe(AGENT_KERNEL_VERSION)
    expect(hasAgentSkill(plan, 'security-boundaries')).toBe(true)
    expect(hasAgentSkill(plan, 'evidence-grounding')).toBe(true)
    expect(hasAgentSkill(plan, 'knowledge-retrieval')).toBe(true)
    expect(hasAgentSkill(plan, 'product-consultation')).toBe(true)
    expect(hasAgentSkill(plan, 'appointment-booking')).toBe(true)
    expect(hasAgentSkill(plan, 'product-card-hydration')).toBe(true)
    expect(hasAgentSkill(plan, 'persian-response-polish')).toBe(true)
    expect(plan.active[0]?.key).toBe('security-boundaries')
  })

  it('keeps skill traces privacy-safe and versioned', () => {
    const plan = compileAgentSkillPlan({ language: 'en', userMessage: 'Thanks', history: [], deterministicClosing: true })
    const trace = agentSkillTrace(plan)
    expect(trace.kernelVersion).toBe(AGENT_KERNEL_VERSION)
    expect(JSON.stringify(trace)).not.toContain('Thanks')
    expect(trace.active.every((skill) => Boolean(skill.version))).toBe(true)
    expect(hasAgentSkill(plan, 'knowledge-retrieval')).toBe(false)
    expect(hasAgentSkill(plan, 'appointment-booking')).toBe(false)
  })

  it('assembles the skill instructions into the existing response pipeline', () => {
    const messages = buildMessages({
      systemPrompt: 'فقط از اطلاعات تأییدشده پاسخ بده.',
      language: 'fa',
      contextText: '[1] مهلت بازگشت ۷ روز است.',
      catalogProducts: [{
        id: 'product-1',
        name: 'محصول کامل آزمایشی',
        description: 'ضدآب',
        price: 250_000,
        stock: 3,
        category: null,
        image: null,
        url: null,
        attributes: null,
        tags: [],
      }],
      history: [],
      userMessage: 'قیمت و موجودی محصول کامل آزمایشی را بگو',
      catalogAccessEnabled: true,
      productRequest: {
        isProductTurn: true,
        explicitShowcase: false,
        resetProductContext: false,
        requestNewTopic: false,
        requestedCount: 1,
        inventoryMode: 'ANY',
      },
    })
    const prompt = messages[0]?.content ?? ''
    expect(prompt).toContain('نام کامل محصول را همان‌طور که در کاتالوگ آمده ذکر کن')
    expect(prompt).toContain('فقط وقتی انجام‌شده محسوب می‌شود که نتیجهٔ معتبر ابزار')
    expect(prompt).toContain('انجام شد')
  })

  it('runs Persian polish only through its active postprocessor skill', () => {
    const fa = compileAgentSkillPlan({ language: 'fa', userMessage: 'سلام', history: [] })
    const en = compileAgentSkillPlan({ language: 'en', userMessage: 'Hello', history: [] })
    expect(runAgentSkillPostprocessors('پاسخ کوتاه.', fa)).toBe('پاسخ کوتاه')
    expect(runAgentSkillPostprocessors('English.', en)).toBe('English.')
  })

  it('restores a trusted exact name when a single-product answer omits it', () => {
    const plan = compileAgentSkillPlan({
      language: 'fa',
      userMessage: 'قیمت محصول آزمایشی را بگو',
      history: [],
      productTurn: true,
      catalogAccessEnabled: true,
    })
    expect(runAgentSkillPostprocessors('قیمت آن ۲۵۰ هزار تومان است.', plan, {
      catalogProducts: [{ name: 'محصول کامل آزمایشی' }],
    })).toBe('محصول کامل آزمایشی: قیمت آن ۲۵۰ هزار تومان است')
    expect(runAgentSkillPostprocessors('میز تلویزیون سایز ۱۴۰ موجود است.', plan, {
      catalogProducts: [{ name: 'میز تلویزیون سایز 140' }],
    })).toBe('میز تلویزیون سایز ۱۴۰ موجود است')
  })

  it('keeps all manifests unique and versioned', () => {
    const keys = AGENT_SKILL_MANIFESTS.map((skill) => skill.key)
    expect(new Set(keys).size).toBe(keys.length)
    expect(AGENT_SKILL_MANIFESTS.every((skill) => /^\d+\.\d+\.\d+$/.test(skill.version))).toBe(true)
  })
})

describe('order-link fallback for unavailable in-chat purchases', () => {
  it('routes the customer to the trusted product link when ordering in chat is requested', () => {
    const orderRequest = 'برام ثبت کن این شومیز رو'
    const out = enforceActionCapabilities({
      reply: 'حتفاً الان ثبتش می‌کنم!',
      userMessage: orderRequest,
      isFa: true,
      orderUrl: 'https://shop.example.com/product/shomiz-0788',
    })
    expect(out).toContain('https://shop.example.com/product/shomiz-0788')
    expect(out).toContain('از این لینک وارد شوید')
    expect(out).not.toContain('حتفاً')
  })

  it('offers the site/operator path when no trusted product link exists', () => {
    const out = enforceActionCapabilities({
      reply: 'می‌تونم براتون ثبتش کنم',
      userMessage: 'می‌خوام از همین‌جا خرید کنم',
      isFa: true,
      orderUrl: null,
    })
    expect(out).toContain('صفحهٔ محصول در سایت فروشگاه')
    expect(out).not.toContain('می‌تونم براتون')
  })

  it('fully replaces the reply with the order-link notice on an explicit order request', () => {
    const out = enforceActionCapabilities({
      reply: 'قیمت این محصول ۲۵۰ هزار تومان است. می‌تونم سفارش رو برات ثبت کنم.',
      userMessage: 'سفارش رو نهایی کن',
      isFa: true,
      orderUrl: 'https://shop.example.com/p/1',
    })
    // The deterministic last line of defence replaces the whole reply when
    // the user asked to place the order — checkout promises never survive.
    expect(out).toContain('https://shop.example.com/p/1')
    expect(out).not.toContain('می‌تونم سفارش رو برات ثبت کنم')
  })

  it('does not rewrite grounded order-tracking replies (verified order present)', () => {
    const reply = 'سفارش ۱۲۳ شما ثبت شده و در حال پردازش است.'
    const out = enforceActionCapabilities({
      reply,
      userMessage: 'وضعیت سفارشم چیه؟',
      isFa: true,
      orderUrl: null,
      hasGroundedOrder: true,
    })
    expect(out).toBe(reply)
  })

  it('rewrites a fabricated order-status claim when no verified order is in context', () => {
    const out = enforceActionCapabilities({
      reply: 'سفارش ۱۲۳ شما ثبت شده و در حال پردازش است.',
      userMessage: 'وضعیت سفارشم چیه؟',
      isFa: true,
      orderUrl: null,
    })
    expect(out).toContain('امکان ثبت یا نهایی‌کردن سفارش داخل این گفتگو فعال نیست')
  })

  it('validates order URLs strictly (http/https only)', () => {
    expect(safeOrderUrl('https://shop.example.com/p/1')).toBe('https://shop.example.com/p/1')
    expect(safeOrderUrl('javascript:alert(1)')).toBeNull()
    expect(safeOrderUrl('//protocol-relative.example.com')).toBeNull()
    expect(safeOrderUrl(null)).toBeNull()
    expect(safeOrderUrl('  ')).toBeNull()
  })

  it('postprocess injects the catalog product link into the deterministic fallback', () => {
    const plan = compileAgentSkillPlan({
      language: 'fa',
      userMessage: 'برام ثبت کن این رو',
      history: [],
      productTurn: true,
      catalogAccessEnabled: true,
    })
    const out = runAgentSkillPostprocessors('می‌تونم همین‌جا برات ثبتش کنم!', plan, {
      userMessage: 'برام ثبت کن این رو',
      isFa: true,
      catalogProducts: [{ name: 'شومیز روناز ۰۷۸۸', url: 'https://shop.example.com/p/0788' }],
    })
    expect(out).toContain('https://shop.example.com/p/0788')
    expect(out).not.toContain('می‌تونم همین‌جا')
  })
})
