import { describe, expect, it } from 'vitest'
import {
  enforceHumanizerPolish,
  humanizerPolishInstruction,
} from '@/lib/agent-kernel/skills/humanizer-polish'
import { hasAgentSkill } from '@/lib/agent-kernel/contracts'
import { compileAgentSkillPlan } from '@/lib/agent-kernel/registry'
import { runAgentSkillPostprocessors } from '@/lib/agent-kernel/postprocess'

describe('humanizer polish — deterministic transforms', () => {
  it('collapses repeated punctuation and stray spaces before punctuation', () => {
    const out = enforceHumanizerPolish({ reply: 'سلام !!!! موجود هستش !!!' })
    expect(out.reply).toBe('سلام! موجود هستش!')
    expect(out.codes).toContain('HUMANIZER_PUNCT_COLLAPSED')
  })

  it('never touches URLs, decimals or ellipses', () => {
    const reply = 'جزئیات: https://vigent.ir/a.b؟ نسخه ۱٫۵…'
    expect(enforceHumanizerPolish({ reply }).reply).toBe(reply)
  })

  it('trims decorative emoji bursts at the edges of short replies', () => {
    const out = enforceHumanizerPolish({ reply: '🎉🎉🎉 سلام، سفارش‌ت رسید 🚀🚀🚀' })
    expect(out.reply).toBe('🎉 سلام، سفارش‌ت رسید 🚀')
    expect(out.codes).toContain('HUMANIZER_EMOJI_BURST')
  })

  it('keeps a single emoji exactly where the agent put it', () => {
    const reply = 'سلام! سفارش‌ت رسید 🚀'
    expect(enforceHumanizerPolish({ reply }).reply).toBe(reply)
  })

  it('never rewrites lists or long structured replies', () => {
    const reply = '• گزینه اول 🎉🎉\n• گزینه دوم 🎁🎁\n• گزینه سوم'
    const result = enforceHumanizerPolish({ reply })
    expect(result.reply).toBe(reply)
    expect(result.codes).not.toContain('HUMANIZER_EMOJI_BURST')
  })

  it('skips fenced code content entirely', () => {
    const reply = 'کد:\n```\nconst a = "!!!";\n```'
    expect(enforceHumanizerPolish({ reply }).reply).toBe(reply)
  })
})

describe('humanizer polish — detection-only codes', () => {
  it('detects the not-X-but-Y contrast, forced triad and dramatic closer', () => {
    const reply = 'ما فقط یک فروشگاه نیستیم، بلکه شریک شما هستیم. **کیفیت**، **سرعت**، **اعتماد**. رضایت شما، موفقیت ماست!'
    const result = enforceHumanizerPolish({ reply })
    expect(result.codes).toContain('HUMANIZER_NOT_X_BUT_Y')
    expect(result.codes).toContain('HUMANIZER_FORCED_TRIAD')
    expect(result.codes).toContain('HUMANIZER_DRAMATIC_CLOSER')
  })

  it('detects stacked stock adjectives without rewriting the text', () => {
    const result = enforceHumanizerPolish({ reply: 'این گوشی بی‌نظیر و خیره‌کننده است.' })
    expect(result.codes).toContain('HUMANIZER_STOCK_WORDS')
    expect(result.reply).toBe('این گوشی بی‌نظیر و خیره‌کننده است.')
  })

  it('returns no codes for already-natural prose', () => {
    const result = enforceHumanizerPolish({ reply: 'بله، این مدل موجوده و ارسال به تهران دو روز کاری طول می‌کشه.' })
    expect(result.codes).toEqual([])
  })
})

describe('humanizer polish — kernel integration', () => {
  it('activates the skill and instruction for Persian and English turns', () => {
    for (const language of ['fa', 'en']) {
      const plan = compileAgentSkillPlan({ language, userMessage: 'سلام', history: [] })
      expect(hasAgentSkill(plan, 'humanizer-polish')).toBe(true)
      expect(plan.instructions.humanizer).toBe(humanizerPolishInstruction(language !== 'en'))
    }
  })

  it('runs inside the postprocessor chain and respects the kill switch', () => {
    const plan = compileAgentSkillPlan({ language: 'fa', userMessage: 'سلام', history: [] })
    const out = runAgentSkillPostprocessors('سلام !!! 🎉🎉🎉', plan, { isFa: true })
    expect(out).toBe('سلام! 🎉')

    process.env.AI_HUMANIZER_DISABLE = '1'
    try {
      const offPlan = compileAgentSkillPlan({ language: 'fa', userMessage: 'سلام', history: [] })
      expect(hasAgentSkill(offPlan, 'humanizer-polish')).toBe(false)
      expect(offPlan.instructions.humanizer).toBe('')
      expect(runAgentSkillPostprocessors('سلام !!! 🎉🎉🎉', offPlan, { isFa: true })).toBe('سلام !!! 🎉🎉🎉')
    } finally {
      delete process.env.AI_HUMANIZER_DISABLE
    }
  })
})
