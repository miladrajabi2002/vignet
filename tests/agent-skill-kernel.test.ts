import { describe, expect, it } from 'vitest'
import { buildMessages } from '@/lib/ai/rag'
import { agentSkillTrace, hasAgentSkill } from '@/lib/agent-kernel/contracts'
import { AGENT_KERNEL_VERSION, AGENT_SKILL_MANIFESTS, compileAgentSkillPlan } from '@/lib/agent-kernel/registry'
import { runAgentSkillPostprocessors } from '@/lib/agent-kernel/postprocess'

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
