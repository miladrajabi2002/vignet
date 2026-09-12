import { describe, expect, it } from 'vitest'
import { detectTurnLanguage, numberLocale } from '@/lib/ai/turn-language'
import { languageMirroringInstruction } from '@/lib/agent-kernel/skills/language-mirroring'
import { agentSkillTrace } from '@/lib/agent-kernel/contracts'
import { compileAgentSkillPlan } from '@/lib/agent-kernel/registry'
import { buildMessages } from '@/lib/ai/rag'
import { planProductRequest } from '@/lib/ai/conversation'
import { greetingReplyText, isGreetingOnlyMessage } from '@/lib/channels/greeting'
import { showcaseIntroText } from '@/lib/products/presentation'
import type { ChatMessage } from '@/lib/ai/openrouter'

const user = (content: string): ChatMessage => ({ role: 'user', content })

describe('turn language detection — script and function-word evidence', () => {
  it('classifies Persian messages as fa', () => {
    expect(detectTurnLanguage('سلام، قیمت پیراهن چنده؟')).toBe('fa')
    expect(detectTurnLanguage('دنبال یه شومیز خنک برای تابستونم')).toBe('fa')
    expect(detectTurnLanguage('ممنون از راهنماییتون')).toBe('fa')
  })

  it('classifies English messages as en', () => {
    expect(detectTurnLanguage('Hi, do you ship to Tehran?')).toBe('en')
    expect(detectTurnLanguage('how much is this dress?')).toBe('en')
    expect(detectTurnLanguage('thanks a lot!')).toBe('en')
  })

  it('classifies Arabic messages as ar even without Persian markers', () => {
    expect(detectTurnLanguage('مرحبا، هل هذا الفستان متوفر؟')).toBe('ar')
    expect(detectTurnLanguage('شكرا جزيلا على المساعدة')).toBe('ar')
    expect(detectTurnLanguage('اريد ان اشتري هذا المنتج، كم السعر؟')).toBe('ar')
    // Arabic-keyboard forms (Arabic yeh ي / kaf ك) are strong evidence too.
    expect(detectTurnLanguage('السلام عليكم، كيف حالك؟')).toBe('ar')
  })

  it('does not mistake Persian for Arabic (Persian-only letters dominate)', () => {
    expect(detectTurnLanguage('سلام می‌خوام قیمت پیراهنو بدونم')).toBe('fa')
    expect(detectTurnLanguage('چطور میتونم کمکتون کنم؟')).toBe('fa')
  })

  it('does not mistake Arabic-script Persian greetings for Arabic', () => {
    // «سلام» is in BOTH vocabularies; Persian wins ties by platform default.
    expect(detectTurnLanguage('سلام')).toBe('fa')
    expect(detectTurnLanguage('سلام علیکم')).toBe('fa')
  })

  it('inherits the last lettered customer message for digits-only turns', () => {
    const history: ChatMessage[] = [
      user('مرحبا، اريد ان اسال عن المنتجات'),
      { role: 'assistant', content: 'أهلًا بك، تفضل بأسئلتك.' },
    ]
    expect(detectTurnLanguage('0788', history)).toBe('ar')
    expect(detectTurnLanguage('۰۷۰۶', history)).toBe('ar')
  })

  it('falls back to fa for digits-only turns with no lettered history', () => {
    expect(detectTurnLanguage('0788')).toBe('fa')
    expect(detectTurnLanguage('❤️')).toBe('fa')
    expect(detectTurnLanguage('')).toBe('fa')
  })

  it('classifies mixed scripts by dominance', () => {
    // Latin dominates → English.
    expect(detectTurnLanguage('salam, this dress is beautiful, میتونم قیمتشو بدونم؟')).toBe('en')
    // Mostly Persian with a brand word → Persian.
    expect(detectTurnLanguage('این مدل Nike اصل هست؟')).toBe('fa')
  })

  it('exposes number locales per language', () => {
    expect(numberLocale('fa')).toBe('fa-IR')
    expect(numberLocale('ar')).toBe('ar-EG')
    expect(numberLocale('en')).toBe('en-US')
    expect((1498000).toLocaleString(numberLocale('fa'))).toContain('۴۹۸')
  })
})

describe('agent kernel — language-mirroring replaces the pinned locale', () => {
  it('activates the language-mirroring skill on every turn', () => {
    const plan = compileAgentSkillPlan({ language: 'fa', userMessage: 'سلام', history: [] })
    expect(plan.active.some((skill) => skill.key === 'language-mirroring')).toBe(true)
    const trace = agentSkillTrace(plan)
    expect(trace.active.some((skill) => skill.key === 'language-mirroring')).toBe(true)
  })

  it('never instructs the model to answer in a fixed language', () => {
    for (const language of ['fa', 'en', 'ar']) {
      const plan = compileAgentSkillPlan({ language, userMessage: 'hi', history: [] })
      expect(plan.instructions.language).not.toContain('به زبان فارسی پاسخ بده')
      expect(plan.instructions.language).not.toContain('Respond in English.')
      // The mirroring rule exists in both instruction scripts.
      expect(/همان زبان|same language/i.test(plan.instructions.language)).toBe(true)
    }
  })

  it('keeps Persian kernel instructions for Arabic turns (output follows the mirror rule)', () => {
    const plan = compileAgentSkillPlan({ language: 'ar', userMessage: 'مرحبا', history: [] })
    expect(plan.instructions.language).toBe(languageMirroringInstruction(true))
  })

  it('builds the system message with the mirroring instruction injected', () => {
    const messages = buildMessages({
      systemPrompt: 'تو دستیار فروش هستی.',
      language: 'fa',
      contextText: '',
      catalogProducts: [],
      history: [],
      userMessage: 'مرحبا، هل هذا الفستان متوفر؟',
    })
    const system = messages.find((message) => message.role === 'system')?.content ?? ''
    expect(system).toContain(languageMirroringInstruction(true))
    expect(system).not.toContain('به زبان فارسی پاسخ بده.')
  })
})

describe('deterministic templates — Arabic and English variants', () => {
  it('renders the showcase intro in Arabic for Arabic turns', () => {
    const intro = showcaseIntroText({ count: 3, subject: '', lang: 'ar' })
    expect(intro).toContain('خيارًا متوفرًا')
    expect(intro).not.toContain('موجود و مرتبط')
  })

  it('renders the showcase intro in English for English turns', () => {
    expect(showcaseIntroText({ count: 3, subject: '', lang: 'en' })).toContain('available matching options')
  })

  it('keeps the Persian showcase intro for Persian turns', () => {
    expect(showcaseIntroText({ count: 3, subject: '', lang: 'fa' })).toContain('محصول موجود و مرتبط')
  })

  it('supports the legacy isFa flag (backward compatibility)', () => {
    expect(showcaseIntroText({ count: 3, isFa: true })).toContain('محصول موجود و مرتبط')
    expect(showcaseIntroText({ count: 3, isFa: false })).toContain('available matching options')
  })
})

describe('greeting fast path — Arabic greetings get Arabic replies', () => {
  it('recognizes a bare Arabic greeting', () => {
    expect(isGreetingOnlyMessage('مرحبا')).toBe(true)
    expect(isGreetingOnlyMessage('السلام علیکم')).toBe(true)
  })

  it('greets Arabic customers in Arabic', () => {
    const reply = greetingReplyText('مرحبا', false, { businessName: 'هفت‌مین' })
    expect(reply).toContain('مرحبا')
    expect(reply).toContain('هفت‌مین')
    expect(reply).not.toContain('خوش آمدید')
  })

  it('keeps English and Persian greetings as before', () => {
    expect(greetingReplyText('hello', false)).toContain('Hello')
    expect(greetingReplyText('سلام', false)).toContain('خوش آمدید')
  })
})

describe('regression — product request planning stays intact', () => {
  it('still routes a Persian bare product code to the code variant vitrine', () => {
    const plan = planProductRequest('پیراهن ۰۷۰۶', [])
    expect(plan.codeVariantVitrine).toBe(true)
    expect(plan.codeIdentified).toBe(true)
    expect(plan.searchTerms).toContain('0706')
  })

  it('still routes an Arabic digits message to the same deterministic path', () => {
    // Arabic-Indic digits ٠٧٨٨ normalize to 0788 and stay a product code.
    const plan = planProductRequest('٠٧٨٨', [])
    expect(plan.codeIdentified).toBe(true)
  })
})
