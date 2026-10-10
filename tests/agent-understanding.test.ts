import { afterEach, describe, expect, it } from 'vitest'
import { parseUnderstanding } from '@/lib/agent/understand/schema'
import { ACTION_CONFIDENCE_FLOOR, verifyUnderstanding } from '@/lib/agent/understand/verify'
import { routeFromUnderstanding } from '@/lib/agent/turn/route'
import { composeTurnBrief, closingReplyFor } from '@/lib/agent/turn/brief'
import { legacyReading, readingDiff } from '@/lib/agent/understand/legacy-adapter'
import { parseUnderstandingConfig, resolveUnderstandingMode, resetUnderstandingConfigCache, routesFromUnderstanding } from '@/lib/agent/understand/mode'
import { recentShownCardIds, vocabularySample } from '@/lib/agent/understand/candidates'
import { buildUnderstandPayload } from '@/lib/agent/understand/prompt'
import { createEmptyConversationWorkingState } from '@/lib/ai/conversation-state'
import { digitsAppearIn, priceAppearsIn, phraseAppearsIn, tokensMostlyIn, verifiedMobile } from '@/lib/agent/parsers/evidence'
import type { TurnCandidates, TurnUnderstanding } from '@/lib/agent/understand/types'

const candidates = (overrides: Partial<TurnCandidates> = {}): TurnCandidates => ({
  capabilities: ['products', 'order_capture', 'restock', 'order_tracking', 'handoff'],
  pending: null,
  task: null,
  shownCards: [
    { ref: 'card:1', id: 'p-arta', name: 'میز تلویزیون آرتا ۱۹۰', price: 21_000_000, variants: ['گردویی', 'سفید'] },
    { ref: 'card:2', id: 'p-apadana#v14', name: 'میز تلویزیون آپادانا ۱۶۰ — آبی', price: 18_500_000 },
  ],
  cart: [],
  active: { ref: 'active', id: 'p-sofa', name: 'مبل راحتی ونیز', price: 48_000_000 },
  seen: [{ ref: 'seen:1', id: 'p-puff', name: 'پاف مراکشی' }],
  services: [],
  courses: [],
  vocabulary: ['میز', 'تلویزیون', 'آرتا', 'آپادانا', 'مبل', 'راحتی', 'ونیز', 'پاف', 'مراکشی'],
  categories: [],
  ...overrides,
})

const reading = (overrides: Partial<TurnUnderstanding>): TurnUnderstanding => ({
  v: 1,
  language: 'fa',
  relation: 'other',
  acts: [{ type: 'other' }],
  answersPending: false,
  customer: { mood: 'neu', buy: 1, cues: [] },
  confidence: 0.9,
  ...overrides,
})

describe('understanding schema: tolerant parsing of the model reading', () => {
  it('keeps only fields each act type allows and drops unknown types', () => {
    const parsed = parseUnderstanding(JSON.stringify({
      language: 'fa',
      relation: 'reference',
      confidence: '0.82',
      customer: { mood: 'neu', buy: 2, cues: ['pricey', 'bogus'] },
      acts: [
        { type: 'product_question', target: 'card:2', field: 'price', terms: ['ignored'] },
        { type: 'teleport', target: 'card:1' },
        { type: 'cart_edit', ops: [{ op: 'set_quantity', line: 'cart:1', quantity: '0' }, { op: 'add' }] },
      ],
    }))
    expect(parsed?.acts).toEqual([
      { type: 'product_question', target: 'card:2', field: 'price' },
      { type: 'cart_edit', ops: [{ op: 'remove', line: 'cart:1' }] },
    ])
    expect(parsed?.confidence).toBe(0.82)
    expect(parsed?.customer.cues).toEqual(['pricey'])
  })

  it('returns null for output with no usable act (caller falls back to legacy)', () => {
    expect(parseUnderstanding('{"acts":[]}')).toBeNull()
    expect(parseUnderstanding('not json')).toBeNull()
    expect(parseUnderstanding({ acts: [{ type: 'product_search' }] })).toBeNull()
  })

  // Shapes the live model produced in the evaluation (evals/results).
  it('reads search words written in `query` and «act» for «type»', () => {
    const parsed = parseUnderstanding({ relation: 'new_goal', customer: { mood: 'neu', buy: 1 }, acts: [{ act: 'product_search', display: 'showcase', target: 'active', query: 'شومیز', severity: 'low' }] })
    expect(parsed?.acts).toEqual([{ type: 'product_search', terms: ['شومیز'], display: 'showcase' }])
  })

  it('reads one cart change written flat, but never guesses it from a borrowed `action`', () => {
    const flat = parseUnderstanding({ relation: 'reference', customer: { mood: 'neu', buy: 3 }, acts: [{ type: 'cart_edit', op: 'set_quantity', line: 'cart:1', quantity: 3 }] })
    expect(flat?.acts).toEqual([{ type: 'cart_edit', ops: [{ op: 'set_quantity', line: 'cart:1', quantity: 3 }] }])
    // «نه یکی کافیه» came back as {target: cart:1, action: cancel}: removing the line would be wrong.
    expect(parseUnderstanding({ relation: 'answer', customer: { mood: 'neu', buy: 3 }, acts: [{ type: 'cart_edit', target: 'cart:1', action: 'cancel' }] })).toBeNull()
  })

  it('an empty act list inside a complete reading means «nothing to act on»', () => {
    const parsed = parseUnderstanding({ language: 'fa', relation: 'other', confidence: 0.9, customer: { mood: 'neu', buy: 0, cues: [] }, acts: [] })
    expect(parsed?.acts).toEqual([{ type: 'other' }])
  })
})

describe('evidence checks (shape-certain parsers)', () => {
  it('accepts numbers, phones and prices only when the customer wrote them', () => {
    expect(verifiedMobile('09121112233', 'شماره‌م ۰۹۱۲ ۱۱۱ ۲۲ ۳۳ هست')).toBe('09121112233')
    expect(verifiedMobile('09121112233', 'شماره ندارم')).toBeNull()
    expect(priceAppearsIn(15_000_000, 'زیر ۱۵ میلیون')).toBe(true)
    expect(priceAppearsIn(150_000_000, 'زیر ۱۵ میلیون')).toBe(false)
    expect(priceAppearsIn(500_000, 'بودجه‌م ۵۰۰ هزار')).toBe(true)
    expect(digitsAppearIn('45891', 'سفارش شماره ۴۵۸۹۱')).toBe(true)
    expect(phraseAppearsIn('میز تلویزیون', 'میزتلویزیون دارین')).toBe(true)
    expect(tokensMostlyIn('تهران، سعادت‌آباد، خیابان سرو، پلاک ۱۲', 'تهران سعادت آباد خیابان سرو پلاک ۱۲')).toBe(true)
  })
})

describe('verification against the closed candidate world', () => {
  it('drops references that are not candidates of this turn', () => {
    const verified = verifyUnderstanding({
      understanding: reading({ acts: [{ type: 'product_question', target: 'card:9', field: 'price' }] }),
      candidates: candidates(),
      message: 'نهمی چنده؟',
      recentText: '',
    })
    expect(verified.acts).toEqual([{ type: 'other' }])
    expect(verified.notes.map((note) => note.code)).toContain('UNKNOWN_REF')
  })

  it('removes a budget the message never stated and search terms with no evidence', () => {
    const verified = verifyUnderstanding({
      understanding: reading({ acts: [{ type: 'product_search', terms: ['مبل', 'چستر'], display: 'consult', maxPrice: 90_000_000 }] }),
      candidates: candidates(),
      message: 'یه مبل راحت میخوام',
      recentText: '',
      vocabulary: new Set(['مبل', 'راحتی']),
    })
    const search = verified.acts[0]
    expect(search).toMatchObject({ type: 'product_search', terms: ['مبل'] })
    expect('maxPrice' in search).toBe(false)
    expect(verified.notes.map((note) => note.code)).toEqual(expect.arrayContaining(['TERM_NOT_IN_EVIDENCE', 'NUMBER_NOT_IN_MESSAGE']))
  })

  it('keeps a vocabulary spelling fix («پوف» → «پاف»)', () => {
    const verified = verifyUnderstanding({
      understanding: reading({ acts: [{ type: 'product_search', terms: ['پاف'], display: 'showcase' }] }),
      candidates: candidates(),
      message: 'پوف دارین؟',
      recentText: '',
      vocabulary: new Set(['پاف']),
    })
    expect(verified.acts[0]).toMatchObject({ type: 'product_search', terms: ['پاف'] })
  })

  it('never executes a capability the agent does not have', () => {
    const verified = verifyUnderstanding({
      understanding: reading({ acts: [{ type: 'booking', action: 'book', date: 'شنبه' }] }),
      candidates: candidates(),
      message: 'شنبه وقت میخوام',
      recentText: '',
    })
    expect(verified.acts).toEqual([{ type: 'other' }])
    expect(verified.unavailable).toEqual(['bookings'])
  })

  it('a low-confidence reading never changes a cart or an order', () => {
    const verified = verifyUnderstanding({
      understanding: reading({
        confidence: ACTION_CONFIDENCE_FLOOR - 0.1,
        acts: [{ type: 'order_cancel' }, { type: 'policy_question', topic: 'delivery_time' }],
      }),
      candidates: candidates({ cart: [{ ref: 'cart:1', line: 1, productId: 'p-lamp', name: 'آباژور', variant: null, quantity: 1 }] }),
      message: 'نمیدونم شاید',
      recentText: '',
    })
    expect(verified.acts.map((act) => act.type)).toEqual(['policy_question'])
    expect(verified.clarify?.reason).toBe('missing_info')
  })

  it('verifies order details against the message and rejects invented ones', () => {
    const message = 'رضا محمدی ۰۹۱۲۱۱۱۲۲۳۳ تهران، خیابان سرو، پلاک ۱۲'
    const verified = verifyUnderstanding({
      understanding: reading({ acts: [{ type: 'order_details', name: 'رضا محمدی', phone: '09121112233', city: 'تهران', address: 'تهران، خیابان سرو، پلاک ۱۲', postalCode: '1234567890' }] }),
      candidates: candidates({ cart: [{ ref: 'cart:1', line: 1, productId: 'p-lamp', name: 'آباژور', variant: null, quantity: 1 }] }),
      message,
      recentText: '',
    })
    expect(verified.acts[0]).toEqual({ type: 'order_details', name: 'رضا محمدی', phone: '09121112233', city: 'تهران', address: 'تهران، خیابان سرو، پلاک ۱۲' })
    expect(verified.notes.map((note) => note.code)).toContain('NUMBER_NOT_IN_MESSAGE')
  })

  it('answers_pending without a pending question is ignored', () => {
    const verified = verifyUnderstanding({ understanding: reading({ answersPending: true }), candidates: candidates(), message: 'آره', recentText: '' })
    expect(verified.answersPending).toBe(false)
  })
})

function route(understanding: TurnUnderstanding, overrides: Partial<TurnCandidates> = {}, message = 'x') {
  const c = candidates(overrides)
  const verified = verifyUnderstanding({ understanding, candidates: c, message, recentText: '', vocabulary: new Set(c.vocabulary) })
  return { verified, route: routeFromUnderstanding({ verified, candidates: c, message, state: createEmptyConversationWorkingState('s'), lang: 'fa' }) }
}

describe('router: verified acts → decisions for the existing executors', () => {
  it('a question about card 2 loads exactly that row (variation suffix kept)', () => {
    const { route: decided } = route(reading({ acts: [{ type: 'product_question', target: 'card:2', field: 'price' }] }))
    expect(decided.productIds).toEqual(['p-apadana#v14'])
    expect(decided.productsIdentified).toBe(true)
    expect(decided.productPlan).toMatchObject({ isProductTurn: true, includeProductCards: false })
  })

  it('compare two cards: both rows by id, comparison consult, no search', () => {
    const { route: decided } = route(reading({ acts: [{ type: 'compare', targets: ['card:1', 'card:2'] }] }))
    expect(decided.productIds).toEqual(['p-arta', 'p-apadana#v14'])
    expect(decided.productPlan?.comparisonConsult).toBe(true)
    expect(decided.catalogSearch).toBeNull()
  })

  it('a budget with a superlative becomes one server-side search', () => {
    const { route: decided } = route(
      reading({ acts: [{ type: 'product_search', terms: ['مبل', 'راحتی'], display: 'consult', maxPrice: 15_000_000, sort: 'price_asc' }] }),
      {},
      'زیر ۱۵ میلیون ارزون‌ترین مبل راحتی',
    )
    expect(decided.catalogSearch).toMatchObject({ budget: { maxPrice: 15_000_000, minPrice: null }, sort: 'price_asc', reason: 'PRICE_CONSTRAINT' })
    expect(decided.stateTurn.slots.budget).toBe('15000000')
  })

  it('cart edits resolve to cart line numbers; an add of a card keeps its variation id', () => {
    const cart = [
      { ref: 'cart:1', line: 1, productId: 'p-table', name: 'میز جلومبلی سنگی', variant: null, quantity: 1 },
      { ref: 'cart:2', line: 2, productId: 'p-puff#v20', name: 'پاف مراکشی', variant: 'کرم', quantity: 1 },
    ]
    const { route: decided } = route(reading({
      acts: [{ type: 'cart_edit', ops: [{ op: 'remove', line: 'cart:1' }, { op: 'add', target: 'card:2', quantity: 2 }] }],
    }), { cart })
    expect(decided.orderSignals.cartOps).toEqual([
      { op: 'remove', line: 1 },
      { op: 'add', productId: 'p-apadana', variationId: 14, variant: null, quantity: 2 },
    ])
    expect(decided.orderSignals.cartCue).toBe('remove')
    expect(decided.orderTouch).toBe(true)
  })

  it('«همون آبیه رو برمیدارم» starts an order with the exact card', () => {
    const { route: decided } = route(reading({ acts: [{ type: 'order_start', items: [{ target: 'card:2' }] }] }))
    expect(decided.orderSignals.orderIntent).toBe(true)
    expect(decided.orderSignals.startItems).toEqual([{ productId: 'p-apadana', variationId: 14, variant: null, quantity: null }])
  })

  it('a delivery question is policy, never a booking', () => {
    const { route: decided } = route(reading({ acts: [{ type: 'policy_question', topic: 'delivery_time' }] }))
    expect(decided.booking).toBeNull()
    expect(decided.productPlan).toBeNull()
  })

  it('multi-intent: shipping cost + price of the active product, briefed in order', () => {
    const { verified, route: decided } = route(reading({
      acts: [{ type: 'policy_question', topic: 'shipping_cost', detail: 'شیراز' }, { type: 'product_question', target: 'active', field: 'price' }],
    }))
    expect(decided.multiIntent).toBe(true)
    expect(decided.productIds).toEqual(['p-sofa'])
    const brief = composeTurnBrief({ route: decided, refs: verified.refs, lang: 'fa' })
    expect(brief).toContain('۲ چیز')
    expect(brief).toContain('هزینهٔ ارسال (شیراز)')
    expect(brief).toContain('«مبل راحتی ونیز»')
  })

  it('a pure thanks is a deterministic closing; thanks + a question is not', () => {
    expect(route(reading({ acts: [{ type: 'thanks' }] })).route.closing).toBe('thanks')
    expect(route(reading({ acts: [{ type: 'thanks' }, { type: 'policy_question', topic: 'shipping_cost' }] })).route.closing).toBeNull()
    expect(closingReplyFor('defer', 'fa')).toContain('تصمیم')
  })

  it('restock «yes» to the offer is an accept; human request and severe complaint raise the handoff signal', () => {
    const accepted = route(reading({ answersPending: true, acts: [{ type: 'restock_subscribe' }] }), { pending: { kind: 'restock_offer' } })
    expect(accepted.route.restock).toEqual({ request: 'accept', targetId: null })
    expect(route(reading({ acts: [{ type: 'human_request' }] })).route.handoff.human).toBe(true)
    expect(route(reading({ acts: [{ type: 'complaint', severity: 'high' }] })).route.handoff.complaintHigh).toBe(true)
  })

  it('an unavailable capability reaches the brief, never an executor', () => {
    const { verified, route: decided } = route(reading({ acts: [{ type: 'course', action: 'enroll' }] }))
    expect(decided.course).toBeNull()
    expect(composeTurnBrief({ route: decided, refs: verified.refs, lang: 'fa' })).toContain('ثبت‌نام دوره')
  })
})

describe('legacy reading for shadow agreement', () => {
  it('reproduces the known regex misroutes so the diff is visible', () => {
    const legacy = legacyReading({
      message: 'فردا میرسه دستم؟',
      history: [],
      hasDraft: false,
      capabilities: { orderCapture: true, bookings: true, courses: false, restock: true, tracking: true },
    })
    expect(legacy.acts).toContain('booking')
    const diff = readingDiff({ acts: [{ type: 'policy_question', topic: 'delivery_time' }] }, legacy)
    expect(diff.agreed).toBe(false)
    expect(diff.diffKinds).toContain('-booking')
  })
})

describe('rollout mode', () => {
  afterEach(() => {
    delete process.env.AGENT_UNDERSTANDING_MODE
    resetUnderstandingConfigCache()
  })

  it('parses and clamps the stored config; per-workspace overrides win; no env var can force a mode', async () => {
    const config = parseUnderstandingConfig({ mode: 'shadow', domains: { orders: false }, timeoutMs: 99_999, workspaces: { w1: 'on', w2: 'nonsense' } })
    expect(config.mode).toBe('shadow')
    expect(config.domains.orders).toBe(false)
    expect(config.domains.products).toBe(true)
    expect(config.timeoutMs).toBe(15_000)
    expect(config.workspaces).toEqual({ w1: 'on' })
    // A stale «AGENT_UNDERSTANDING_MODE=off» left in a server .env is ignored:
    // after a deploy the admin-panel setting (default «on») decides.
    process.env.AGENT_UNDERSTANDING_MODE = 'off'
    const resolved = await resolveUnderstandingMode('w1')
    expect(resolved.mode).toBe('on')
    expect(routesFromUnderstanding({ ...resolved, mode: 'on' }, 'products')).toBe(true)
    expect(routesFromUnderstanding({ ...resolved, mode: 'shadow' }, 'products')).toBe(false)
  })
})

describe('candidates and payload', () => {
  it('cards come from the most recent reply that showed any, in display order', () => {
    expect(recentShownCardIds([
      { role: 'assistant', content: 'قدیمی [[product:{"id":"old","name":"x"}]]' },
      { role: 'user', content: 'بیشتر' },
      { role: 'assistant', content: 'اینا:\n[[product:{"id":"a","name":"A"}]]\n[[product:{"id":"b#v3","name":"B"}]]' },
      { role: 'user', content: 'دومی' },
      { role: 'assistant', content: 'جواب بدون کارت' },
    ])).toEqual(['a', 'b#v3'])
    expect(vocabularySample(new Set(['میز', 'تلویزیون', '۱۶۰', 'ab', 'مراکشی']), 10)).toEqual(['تلویزیون', 'مراکشی', 'میز'])
  })

  it('the payload carries refs and strips product markers from history', () => {
    const payload = JSON.parse(buildUnderstandPayload({
      message: 'دومی چنده؟',
      recent: [{ role: 'assistant', content: 'اینا [[product:{"id":"a"}]]' }],
      candidates: candidates(),
    }))
    expect(payload.cards.map((card: { ref: string }) => card.ref)).toEqual(['card:1', 'card:2'])
    expect(payload.recent[0].text).toBe('اینا')
    expect(payload.active.ref).toBe('active')
  })
})
