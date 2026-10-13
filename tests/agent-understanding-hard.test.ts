/**
 * Readings the live hard test (2026-10-13) got wrong, as the model wrote them.
 */
import { describe, expect, it } from 'vitest'
import { verifyUnderstanding } from '@/lib/agent/understand/verify'
import { routeFromUnderstanding } from '@/lib/agent/turn/route'
import { composeTurnBrief } from '@/lib/agent/turn/brief'
import { parseUnderstanding } from '@/lib/agent/understand/schema'
import { mentionsPerson, phraseAppearsIn } from '@/lib/agent/parsers/evidence'
import { createEmptyConversationWorkingState } from '@/lib/ai/conversation-state'
import type { Act, TurnCandidates, TurnUnderstanding } from '@/lib/agent/understand/types'

const VOCABULARY = new Set(['بی', 'ریمل', 'ضد', 'آب', 'حجم', 'دهنده', 'بلند', 'کننده', 'شیگلم', 'شامپو', 'شوره', 'بیوکسین', 'آفتاب', 'رنگی', 'پوست', 'چرب', 'کوانتوم', 'مو', 'تخصصی'])

const candidates = (overrides: Partial<TurnCandidates> = {}): TurnCandidates => ({
  capabilities: ['products', 'restock', 'order_tracking', 'handoff'],
  pending: null,
  task: null,
  shownCards: [
    { ref: 'card:1', id: 'p-a', name: 'ریمل و پرایمر مژه دو سر شیگلم', price: 2_470_000 },
    { ref: 'card:2', id: 'p-b', name: 'ریمل رنگی پاستل رنگ سبز', price: 867_000 },
    { ref: 'card:3', id: 'p-c', name: 'ریمل هیپنوز دراما لانکوم', price: 10_393_000 },
  ],
  cart: [],
  active: null,
  seen: [],
  services: [],
  courses: [],
  vocabulary: [...VOCABULARY],
  categories: [],
  ...overrides,
})

const reading = (acts: Act[], overrides: Partial<TurnUnderstanding> = {}): TurnUnderstanding => ({
  v: 1, language: 'fa', relation: 'new_goal', acts, answersPending: false,
  customer: { mood: 'neu', buy: 1, cues: [] }, confidence: 0.9, ...overrides,
})

const verify = (message: string, acts: Act[], extra: { recentText?: string; candidates?: TurnCandidates } = {}) => verifyUnderstanding({
  understanding: reading(acts), candidates: extra.candidates ?? candidates(), message, recentText: extra.recentText ?? '', vocabulary: VOCABULARY,
})

const route = (message: string, acts: Act[], extra: { recentText?: string; candidates?: TurnCandidates } = {}) => {
  const turnCandidates = extra.candidates ?? candidates()
  const verified = verify(message, acts, { ...extra, candidates: turnCandidates })
  return { verified, route: routeFromUnderstanding({ verified, candidates: turnCandidates, message, state: createEmptyConversationWorkingState(), corpusTokens: VOCABULARY, lang: 'fa' }) }
}

describe('search terms the customer wrote stay, rewritten ones go', () => {
  it('«ضدافتاب بی رنک اس پی اف ۵۰»: the product word survives a rewritten phrase', () => {
    const message = 'ضدافتاب بی رنک اس پی اف ۵۰ دارین'
    const verified = verify(message, [{ type: 'product_search', terms: ['ضد آفتاب', 'بی رنگ', 'SPF 50'], display: 'showcase' }])
    expect(verified.acts).toEqual([{ type: 'product_search', terms: ['ضد آفتاب'], display: 'showcase' }])
  })

  it('a phrase rewritten as one term keeps its two-letter catalog word and loses the hanging one', () => {
    const verified = verify('ضدافتاب بی رنک اس پی اف ۵۰ دارین', [{ type: 'product_search', terms: ['ضد آفتاب بی رنگ SPF 50'], display: 'showcase' }])
    expect(verified.acts).toEqual([{ type: 'product_search', terms: ['ضد آفتاب'], display: 'showcase' }])
  })

  it('the plain alef of a typed «ضدافتاب» is the «آ» of «ضد آفتاب»', () => {
    expect(phraseAppearsIn('ضد آفتاب', 'ضدافتاب بی رنگ')).toBe(true)
  })
})

describe('a question about a product the customer names', () => {
  it('the search for it is a consultation, not a vitrine', () => {
    const message = 'شامپو مو چرب کوانتوم بیوکسین چنده؟'
    const { verified, route: routed } = route(message, [
      { type: 'product_search', terms: ['شامپو مو چرب کوانتوم بیوکسین'], display: 'showcase' },
      { type: 'product_question', target: 'active', field: 'price' },
    ], { candidates: candidates({ shownCards: [] }) })
    expect(verified.acts).toEqual([{ type: 'product_search', terms: ['شامپو مو چرب کوانتوم بیوکسین'], display: 'consult' }])
    expect(routed.productPlan?.explicitShowcase).toBe(false)
  })

  it('two named products are searched one by one', () => {
    const message = 'شامپو ضد شوره تخصصی بیوکسین با شامپو مو چرب کوانتوم بیوکسین چه فرقی داره؟'
    const { route: routed } = route(message, [
      { type: 'product_search', terms: ['شامپو ضد شوره تخصصی بیوکسین'], display: 'consult' },
      { type: 'product_search', terms: ['شامپو مو چرب کوانتوم بیوکسین'], display: 'consult' },
    ])
    expect(routed.productSearches).toHaveLength(2)
    expect(routed.productSearches[0]).toContain('شوره')
    expect(routed.productSearches[1]).toContain('کوانتوم')
    expect(routed.productPlan?.comparisonConsult).toBe(true)
    expect(routed.productPlan?.explicitShowcase).toBe(false)
  })
})

describe('the need behind a search', () => {
  it('narrows the search only with words the catalog itself uses', () => {
    const waterproof = route('کدومش ضد آبه؟', [{ type: 'product_search', terms: ['ریمل'], need: 'ضد آب', display: 'consult' }], { recentText: 'ریمل چی دارید؟' })
    expect(waterproof.route.needTerms).toEqual(['ضد', 'آب'])
    const coloured = route('شامپو برای موهای رنگ شده', [{ type: 'product_search', terms: ['شامپو'], need: 'برای موهای رنگ شده', display: 'consult' }])
    expect(coloured.route.needTerms).toEqual([])
  })

  it('«موهای چرب» narrows like the «مو چرب» of a product name', () => {
    const { route: routed } = route('یه شامپو واسه موهای چرب میخوام', [{ type: 'product_search', terms: ['شامپو'], need: 'موهای چرب', display: 'consult' }])
    expect(routed.needTerms).toEqual(['مو', 'چرب'])
    expect(routed.productPlan?.requestedCount).toBe(8)
  })

  it('an exclusion never narrows to the very thing excluded', () => {
    const { route: routed } = route('ضد آفتاب میخوام ولی رنگی نباشه', [{ type: 'product_search', terms: ['ضد آفتاب'], need: 'رنگی نباشه', display: 'consult' }])
    expect(routed.needTerms).toEqual([])
  })

  it('a need with no product word is never a vitrine', () => {
    const { route: routed } = route('یه چیزی برای پوست چرب میخوام', [{ type: 'product_search', terms: [], need: 'پوست چرب', display: 'showcase' }])
    expect(routed.productPlan?.explicitShowcase).toBe(false)
  })

  it('a brand the customer asks to browse is a vitrine of what can be bought', () => {
    const { route: routed } = route('از شیگلم چی دارید؟', [{ type: 'product_search', terms: ['شیگلم'], display: 'browse' }])
    expect(routed.productPlan?.explicitShowcase).toBe(true)
    expect(routed.productPlan?.inventoryMode).toBe('AVAILABLE')
    expect(routed.productPlan?.discoveryBrowse).toBe(false)
  })
})

describe('a request for a person needs the customer’s word for one', () => {
  it('pushing for an answer is not a request for a person', () => {
    const verified = verify('یعنی هیچی نمیدونی؟ حدودی بگو', [
      { type: 'policy_question', topic: 'delivery_time', detail: 'شیراز' },
      { type: 'human_request' },
    ], { recentText: 'اگر بخواهید، موضوع را برای اپراتور خلاصه می‌کنم' })
    expect(verified.acts).toEqual([{ type: 'policy_question', topic: 'delivery_time', detail: 'شیراز' }])
    expect(verified.notes.some((note) => note.code === 'PERSON_NOT_IN_EVIDENCE')).toBe(true)
  })

  it('the customer’s own word, or a bare yes to the offer, is', () => {
    expect(verify('میخوام با یه آدم واقعی حرف بزنم', [{ type: 'human_request' }]).acts).toEqual([{ type: 'human_request' }])
    expect(verify('آره', [{ type: 'human_request' }], { recentText: 'اگر بخواهید به همکارم می‌سپارم' }).acts).toEqual([{ type: 'human_request' }])
    expect(mentionsPerson('اپراتورتون کجاست')).toBe(true)
    expect(mentionsPerson('حدودی بگو')).toBe(false)
  })
})

describe('an agent that takes no orders in chat', () => {
  it('«پرداخت کردم ولی سفارشم ثبت نشده» is a question for the business', () => {
    const message = 'پرداخت کردم پول از حسابم کم شد ولی سفارشم ثبت نشده'
    const { verified, route: routed } = route(message, [{ type: 'payment_claim' }])
    expect(verified.acts).toEqual([{ type: 'knowledge_question', query: message }])
    expect(verified.unavailable).toEqual([])
    expect(routed.knowledgeQuery).toContain('پرداخت کردم')
  })

  it('a decision to buy is reported as something the agent cannot do here', () => {
    const { verified } = route('همینو میخوام ثبت کن برام', [{ type: 'order_start', items: [] }])
    expect(verified.unavailable).toEqual(['order_capture'])
  })
})

describe('requests that have nothing to do with the business', () => {
  it('reach the reply as an instruction to decline, with no product work', () => {
    const { route: routed, verified } = route('یه شعر درباره پاییز بگو', [{ type: 'off_topic' }])
    expect(routed.offTopic).toBe(true)
    expect(routed.productPlan).toBeNull()
    expect(composeTurnBrief({ route: routed, refs: verified.refs, lang: 'fa' })).toContain('ربطی ندارد')
  })

  it('the parser knows the act', () => {
    const parsed = parseUnderstanding({ relation: 'new_goal', customer: { mood: 'neu', buy: 0 }, acts: [{ type: 'off_topic' }] })
    expect(parsed?.acts).toEqual([{ type: 'off_topic' }])
  })
})

describe('what the knowledge base is asked', () => {
  it('a question about a pointed-at product carries its name', () => {
    const { route: routed } = route('ابعادش؟', [{ type: 'product_question', target: 'card:3', field: 'dimensions' }])
    expect(routed.knowledgeQuery).toContain('ابعاد')
    expect(routed.knowledgeQuery).toContain('هیپنوز دراما لانکوم')
  })

  it('a price question needs no knowledge lookup', () => {
    const { route: routed } = route('دومی چنده؟', [{ type: 'product_question', target: 'card:2', field: 'price' }])
    expect(routed.knowledgeQuery).toBe('')
  })
})

describe('references the system resolved', () => {
  it('are stated to the reply model as settled', () => {
    const { route: routed, verified } = route('اولی و سومی رو مقایسه کن', [{ type: 'compare', targets: ['card:1', 'card:3'] }])
    const brief = composeTurnBrief({ route: routed, refs: verified.refs, lang: 'fa' })
    expect(brief).toContain('ریمل و پرایمر مژه دو سر شیگلم')
    expect(brief).toContain('ریمل هیپنوز دراما لانکوم')
    expect(brief).toContain('از مشتری نپرس')
  })

  it('«چه رنگایی داره؟» asks about that product’s own colours', () => {
    const { route: routed } = route('اولی چه رنگایی داره؟', [{ type: 'variants', target: 'card:1', about: 'color' }])
    expect(routed.productPlan?.variantBrowse).toBe(true)
    expect(routed.productPlan?.variantAxis).toBe('color')
  })
})
