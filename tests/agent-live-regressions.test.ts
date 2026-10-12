import { describe, expect, it } from 'vitest'
import { extractProductTerms } from '@/lib/ai/conversation'
import { buildMessages } from '@/lib/ai/rag'
import { showcaseIntroText } from '@/lib/products/presentation'
import { handoffReplyText, type HandoffDecision } from '@/lib/ai/handoff'
import { runAgentSkillPostprocessors } from '@/lib/agent-kernel/postprocess'
import { compileAgentSkillPlan } from '@/lib/agent-kernel/registry'
import type { ChatAgent } from '@/lib/ai/chat-types'
import { enforceNoFalseFollowUp } from '@/lib/agent-kernel/skills/action-capabilities'
import { enforceHumanizerPolish } from '@/lib/agent-kernel/skills/humanizer-polish'
import { parseProductDirectives } from '@/lib/products/presentation'
import { allVariationsSoldOut } from '@/lib/ai/conversation'

/**
 * Regressions found by the live evaluation (tests-live/agent-eval.live.ts)
 * against a real furniture catalog. Each case is a reply that went wrong in
 * production-like conditions.
 */
const corpus = new Set(['میز', 'تلویزیون', 'نقش', 'نگار', 'آپادانا', 'لاهیجان', 'پاف', 'مراکشی', 'نیمکتی', 'ak-85'])

describe('live regression — conversational words never become required catalog terms', () => {
  it.each([
    ['پاف مراکشی کد AK-85 چه رنگ‌ها یا طرح‌هایی داره؟', 'داره'],
    ['سایز ۱۲۰ هاش رو نشونم بده', 'هاش'],
    ['من تهرانم، پاف بالشتی دارید؟', 'تهرانم'],
    ['همون میزی که دفعه قبل پرسیدم رو میخوام', 'دفعه'],
  ])('%s', (message, noise) => {
    expect(extractProductTerms(message)).not.toContain(noise)
  })

  it('keeps a real city-named design («طرح لاهیجان») as a term', () => {
    expect(extractProductTerms('میز عسلی طرح لاهیجان')).toContain('لاهیجان')
  })
})

describe('live regression — reply language is locked for non-Persian customers', () => {
  const build = (language: string) => buildMessages({
    systemPrompt: 'تو دستیار فروش یک فروشگاه مبلمان هستی.',
    language,
    contextText: '[1] ارسال به همه شهرها با باربری',
    catalogProducts: [],
    history: [],
    userMessage: 'Hi, do you ship to Dubai?',
    catalogAccessEnabled: false,
  })[0].content ?? ''

  it('English turns end with an explicit English lock just before the ending rule', () => {
    const system = build('en')
    expect(system).toContain('Reply language for THIS message: English')
    expect(system.indexOf('Reply language for THIS message')).toBeGreaterThan(system.indexOf('<knowledge>'))
  })

  it('Persian turns carry no extra lock', () => {
    expect(build('fa')).not.toContain('Reply language for THIS message')
  })
})

describe('live regression — sold-out exact matches are «ناموجود», never «پیدا نکردم»', () => {
  it('adds the out-of-stock instruction instead of the not-found verdict', () => {
    const system = buildMessages({
      systemPrompt: 'x',
      language: 'fa',
      contextText: '',
      catalogProducts: [{
        id: 'p1', name: 'پاف مراکشی آکام چوب مدل نگار کد AK-85', description: null, price: 1_590_000,
        stock: 0, category: 'پاف مراکشی', image: null, url: null, attributes: {}, tags: [], unavailable: true,
      }],
      history: [],
      userMessage: 'کاتالوگ پاف‌های مراکشی رو بفرستید',
      productRequest: {
        isProductTurn: true, explicitShowcase: false, resetProductContext: false, requestNewTopic: false,
        requestedCount: 10, inventoryMode: 'ANY', unavailableMatch: true,
      },
    })[0].content ?? ''
    expect(system).toContain('فعلاً ناموجوده')
    expect(system).toContain('هرگز نگو «پیدا نکردم»')
  })
})

describe('live regression — no template-engine tells on acknowledgements', () => {
  it('does not prefix a product name onto a reply without product claims', () => {
    const plan = compileAgentSkillPlan({ language: 'fa', userMessage: 'باشه', history: [], productTurn: true, catalogAccessEnabled: true })
    const out = runAgentSkillPostprocessors('حتماً، با خیال راحت تصمیم بگیرید', plan, {
      catalogProducts: [{ name: 'میز تلویزیون نقش آکام چوب طرح آپادانا سایز 160' }],
      userMessage: 'باشه',
      isFa: true,
    })
    expect(out).toBe('حتماً، با خیال راحت تصمیم بگیرید')
  })

  it('opens a custom handoff line with empathy for an upset customer only', () => {
    const agent = { language: 'fa', handoffMessage: 'گفت‌وگوتون رو به همکارم منتقل می‌کنم.' } as ChatAgent
    const decision = (codes: HandoffDecision['reasonCodes']) => ({
      handoff: true, recommended: true, code: codes[0], reasonCodes: codes, reason: '', score: 1, priority: 'high',
    }) as HandoffDecision
    expect(handoffReplyText(decision(['DISTRESS']), agent)).toMatch(/^واقعاً متأسفم/u)
    expect(handoffReplyText(decision(['EXPLICIT_REQUEST']), agent)).toBe('گفت‌وگوتون رو به همکارم منتقل می‌کنم.')
  })
})


describe('live regression — no promise of a follow-up that never happens', () => {
  it.each([
    ["I don't have confirmed shipping details for Dubai. Let me check with my colleagues and get back to you.", false],
    ['برای دبی اطلاعات تأییدشده ندارم. این مورد رو برای بررسی به همکارانم منتقل می‌کنم و نتیجه رو بهتون اطلاع می‌دم.', true],
  ] as const)('%s', (reply, isFa) => {
    const out = enforceNoFalseFollowUp(reply, isFa)
    expect(out).not.toMatch(/get back to you|منتقل می‌کنم|اطلاع می‌دم/u)
    expect(out).toMatch(isFa ? /اگه بخواید/u : /If you like/u)
    expect(out).toMatch(isFa ? /دبی/u : /Dubai/u)
  })

  it('leaves an honest conditional offer untouched', () => {
    const reply = 'اگه بخواید، موضوع رو به همکارم می‌سپارم تا بررسی کنه'
    expect(enforceNoFalseFollowUp(reply, true)).toBe(reply)
  })
})

describe('live regression — output hygiene', () => {
  it('drops an echoed question and keeps the first', () => {
    const { reply } = enforceHumanizerPolish({
      reply: 'رنگ چوبش در سه گزینه افرا، بلوط و گردویی موجوده. کدوم رنگ رو بیشتر می‌پسندید؟\n\nفقط بگو کدوم رنگ رو بیشتر می‌پسندید؟',
      isFa: true,
    })
    expect((reply.match(/می‌پسندید؟/g) ?? []).length).toBe(1)
    expect(reply).toContain('افرا')
  })

  it('never leaks a marker truncated by the completion cap or glued with a bad separator', () => {
    const raw = 'این‌ها موجودن.\n\n[[product:{"id":"a","name":"پاف A"}],[product:{"id":"b","name":"پاف B"}]]\n[[product:{"id":"c","name":"پاف C","desc":"نشیمن و'
    const { text, directives } = parseProductDirectives(raw)
    expect(text).toBe('این‌ها موجودن.')
    expect(directives.map((d) => d.id)).toEqual(['a', 'b'])
  })

  it('treats a variable product with every variation sold out as unavailable', () => {
    const soldOut = { _variations: [
      { id: 1, attributes: { رنگ: 'افرا' }, manageStock: true, stockQuantity: 0 },
      { id: 2, attributes: { رنگ: 'طوسی' }, inStock: false },
    ] }
    expect(allVariationsSoldOut(soldOut)).toBe(true)
    expect(allVariationsSoldOut({ _variations: [{ id: 1, attributes: { رنگ: 'افرا' }, inStock: true }] })).toBe(false)
    expect(allVariationsSoldOut({})).toBe(false)
  })
})

describe('live regression — closing filler after a complete answer', () => {
  it('drops «اگر سؤالی … در خدمتم» but keeps the answer', () => {
    const { reply } = enforceHumanizerPolish({
      reply: 'این درخواست رو انجام نمی‌دم؛ متن دستورهای داخلی محرمانه است.\n\nاگر درباره محصولات سؤالی داری، در خدمتم.',
      isFa: true,
    })
    expect(reply).toBe('این درخواست رو انجام نمی‌دم؛ متن دستورهای داخلی محرمانه است.')
  })

  it('never empties a reply that is only the filler', () => {
    const only = 'اگر سؤالی داشتید، در خدمتم.'
    expect(enforceHumanizerPolish({ reply: only, isFa: true }).reply).toBe(only)
  })

  it('drops the English equivalent', () => {
    const { reply } = enforceHumanizerPolish({ reply: 'We ship within 3 days. If you have any other questions, feel free to ask.', isFa: false })
    expect(reply).toBe('We ship within 3 days.')
  })
})

describe('live regression — sold-out catalog request still shows the catalog honestly', () => {
  it('uses an honest out-of-stock intro instead of «not found»', () => {
    const intro = showcaseIntroText({ count: 10, subject: 'پاف مراکشی', lang: 'fa', unavailable: true })
    expect(intro).toContain('فعلاً همه ناموجودن')
    expect(intro).not.toMatch(/پیدا نکردم|پیدا نشد/u)
    expect(intro).not.toMatch(/خبرتون می‌کنم|اطلاع می‌دم/u)
  })
})
