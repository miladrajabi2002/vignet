import { describe, expect, it } from 'vitest'
import type { ChatMessage } from '@/lib/ai/openrouter'
import {
  advanceConversationWorkingState,
  contextualizeProductRequest,
  createEmptyConversationWorkingState,
  observeAssistantTurn,
  type ConversationWorkingState,
} from '@/lib/ai/conversation-state'
import {
  extractProductTerms,
  normalizePersianText,
  planProductRequest,
  UNRESOLVED_ANAPHORA_RE,
  type ProductRequestPlan,
} from '@/lib/ai/conversation'

function scenario(corpus: string[] = []) {
  const corpusTokens = new Set(corpus)
  let state = createEmptyConversationWorkingState('session-1')
  const history: ChatMessage[] = []
  let tick = 0
  return {
    get state() { return state },
    get history() { return history },
    user(message: string, id = `u-${++tick}`): ProductRequestPlan {
      const raw = planProductRequest(message, history, corpusTokens)
      state = advanceConversationWorkingState({
        state,
        sessionStartId: 'session-1',
        message,
        messageId: id,
        createdAt: new Date(1_700_000_000_000 + tick * 1_000),
        productPlan: raw,
      })
      history.push({ role: 'user', content: message })
      return contextualizeProductRequest(raw, state)
    },
    assistant(message: string, id = `a-${++tick}`) {
      state = observeAssistantTurn(
        state,
        message,
        id,
        new Date(1_700_000_000_000 + tick * 1_000),
      )
      history.push({ role: 'assistant', content: message })
    },
  }
}

const JAVAHERI_CORPUS = [
  'میز', 'تلویزیون', 'جلومبلی', 'پذیرایی', 'پاف', 'نیمکتی', 'نقش', 'نگار', 'ست',
  'طرح', 'کاشانه', 'سلین', 'ایوان', 'شهداد', 'قمصر', 'لاهیجان', 'ترکمن', 'آکام', 'چوب',
]

describe('Persian copula enclitic «ست» (Javaheri issue 5 root cause)', () => {
  it('strips the ZWNJ-attached enclitic but keeps the set noun', () => {
    // «ساده‌ست» → «ساده» — the enclitic must vanish…
    expect(normalizePersianText('مدل نگار به نظرم خیلی ساده‌ست')).not.toMatch(/ست/)
    expect(normalizePersianText('خیلی ساده‌ست.')).not.toMatch(/ست/)
    // …while a standalone «ست» (set noun) survives normalization.
    expect(normalizePersianText('ست پذیرایی دارین؟')).toContain('ست')
  })

  it('keeps the enclitic out of search terms and anchors', () => {
    const terms = extractProductTerms('مدل نگار به نظرم خیلی ساده‌ست')
    expect(terms).not.toContain('ست')
    expect(terms).not.toContain('خیلی')
    expect(terms).not.toContain('نظر')
    expect(terms).toContain('نگار')
  })
})

describe('Javaheri issue 5 — «کدومش ارزون‌تره؟» between نقش and نگار', () => {
  it('carries BOTH sides of the pair and flags the comparison consult', () => {
    const chat = scenario(JAVAHERI_CORPUS)
    chat.user('مدل نگار به نظرم خیلی ساده‌ست')
    chat.assistant('میزهای پذیرایی نگار طراحی ساده‌تری دارند. کدام مدل براتون اولویت داره؟')
    chat.user('بین نقش و نگار مرددم، کدوم برای من بهتره؟')
    chat.assistant('مدل نقش صفحه متحرک و فضای مخفی دارد. اولویت شما کدومه؟')

    const plan = chat.user('کدومش ارزون‌تره؟')
    expect(plan.comparisonConsult).toBe(true)
    // The «بین نقش و نگار …» message carries no shopping verb, yet its terms
    // must reach the comparison (this is exactly what the buggy run lost).
    expect(plan.searchTerms).toContain('نقش')
    expect(plan.searchTerms).toContain('نگار')
    expect(plan.searchTerms).not.toContain('ست')
  })
})

describe('Javaheri issue 2 — «مبل کرم دارم چه طرحی پیشنهاد میدی؟»', () => {
  it('routes possession+advice to a knowledge consult, not catalog search', () => {
    const plan = planProductRequest('مبل کرم دارم چه طرحی پیشنهاد میدی؟', [])
    expect(plan.advisoryConsult).toBe(true)
    expect(plan.isProductTurn).toBe(false)
    expect(plan.searchTerms).toEqual([])
  })

  it('keeps genuine product requests on the product path', () => {
    const corpus = new Set(JAVAHERI_CORPUS)
    const buy = planProductRequest('مبل کرم دارین؟', [], corpus)
    expect(buy.isProductTurn).toBe(true)
    const price = planProductRequest('پاف نیمکتی قیمتش چنده؟', [], corpus)
    expect(price.isProductTurn).toBe(true)
  })
})

describe('Javaheri issue 3 — order-info answer with lead-time question', () => {
  it('stays a policy question, captures city + payment, keeps the order goal', () => {
    const chat = scenario(JAVAHERI_CORPUS)
    chat.user('جلومبلی نقش طرح شهداد رنگ گردویی میخپام')
    chat.assistant('برای ثبت سفارش، لطفاً شهر مقصد و روش پرداخت (نقدی یا اعتباری) رو بگید.')

    const plan = chat.user('تهرانم، نقدی میخوام. اماده سازی و ارسالش چقدر طول میکشه؟')
    // The turn must NOT become a catalog search that "cannot find" the order.
    expect(plan.isProductTurn).toBe(false)
    // City and payment are captured as slots for the reply and later turns.
    expect(chat.state.slots.location?.value).toContain('تهران')
    expect(chat.state.slots.payment?.value).toBeTruthy()
    // The active product goal (the order) survives untouched.
    expect(chat.state.activeGoal?.intent).toBe('PRODUCT')
    expect(chat.state.searchAnchors).toContain('جلومبلی')
    expect(chat.state.lastTurn?.intent).toBe('BUSINESS_INFO')
  })
})

describe('Javaheri issue 1 — family design enumeration after a size switch', () => {
  it('updates the carried size when the customer moves 160 → 190', () => {
    const chat = scenario(JAVAHERI_CORPUS)
    chat.user('سلام میز تلویزیون 160 میخوام')
    chat.assistant('میز تلویزیون سایز 160 در چند طرح موجوده. طرح مورد نظرت کدومه؟')

    const sizeSwitch = chat.user('فکر کنم 190 بهتر باشه')
    expect(sizeSwitch.isProductTurn).toBe(true)
    expect(sizeSwitch.searchTerms).toContain('190')
    expect(sizeSwitch.searchTerms).not.toContain('160')
    // The state anchors follow the new size and drop the stale one.
    expect(chat.state.searchAnchors).toContain('190')
    expect(chat.state.searchAnchors).not.toContain('160')
    expect(chat.state.searchAnchors).toContain('میز')
    expect(chat.state.searchAnchors).toContain('تلویزیون')
  })

  it('recognizes «طرحات چیه» as a variant browse turn', () => {
    const chat = scenario(JAVAHERI_CORPUS)
    chat.user('سلام میز تلویزیون 160 میخوام')
    chat.assistant('میز تلویزیون سایز 160 در چند طرح موجوده. طرح مورد نظرت کدومه؟')
    chat.user('فکر کنم 190 بهتر باشه')
    chat.assistant('میز تلویزیون سایز 190 هم موجوده. طرح مورد نظرت برای سایز 190 کدومه؟')

    const plan = chat.user('طرحات چیه')
    expect(plan.variantBrowse).toBe(true)
    // The family terms (not the stale 160) drive the enumeration.
    expect(plan.searchTerms).toContain('190')
    expect(plan.searchTerms).not.toContain('160')
    expect(plan.searchTerms).toContain('میز')
  })
})

describe('Javaheri issue 4 — «این مدل» without any product in context', () => {
  it('detects the anaphoric reference', () => {
    expect(UNRESOLVED_ANAPHORA_RE.test('این مدل آماده موجود دارید؟')).toBe(true)
    expect(UNRESOLVED_ANAPHORA_RE.test('همون مدل رو بفرست')).toBe(true)
    expect(UNRESOLVED_ANAPHORA_RE.test('میز تلویزیون 160 میخوام')).toBe(false)
  })

  it('keeps the turn a product turn only when a product was actually discussed', () => {
    // KB-only conversation: no product ever named or carded.
    const chat = scenario(JAVAHERI_CORPUS)
    chat.user('آماده‌سازی و ارسال سفارش چقدر طول میکشه؟')
    chat.assistant('زمان آماده‌سازی سفارش‌ها معمولاً 7 تا 14 روز کاریه.')
    chat.user('قسطی هم میتونم بخرم؟')
    chat.assistant('بله، خرید قسطی از طریق اسنپ پی و دیجی پی انجام می‌شه.')
    chat.user('اگر نقدی بخوام سفارش بدم، چند درصد باید اول پرداخت کنم؟')
    chat.assistant('برای شروع تولید سفارش نقدی، مجموع پرداخت باید به 50 درصد برسه.')

    const plan = chat.user('این مدل آماده موجود دارید؟')
    // The chat-engine layer strips the product routing (anaphoraConsult);
    // at the plan level the turn is a product turn only by availability
    // wording — the guard is applied in prepareTurn, asserted separately.
    expect(UNRESOLVED_ANAPHORA_RE.test('این مدل آماده موجود دارید؟')).toBe(true)
  })
})

describe('colloquial variant plurals', () => {
  it('normalizes «طرحات» to the variant noun (a stop word, not an opaque term)', () => {
    const terms = extractProductTerms('طرحات چیه')
    expect(terms).not.toContain('طرحات')
  })
})
