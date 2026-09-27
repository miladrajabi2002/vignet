import { describe, expect, it } from 'vitest'
import {
  composeRestockConfirmed,
  composeRestockNotice,
  detectRestockRequest,
  isItemAvailable,
  restockDedupeKey,
  restockMode,
  restockOfferLine,
} from '@/lib/commerce/restock'
import { catalogToolGate, insertBeforeTurnMarker, parseBudget, PRICE_CONSTRAINT_RE, SUPERLATIVE_RE } from '@/lib/ai/catalog-tools'
import { planProductRequest, type ProductRequestPlan } from '@/lib/ai/conversation'
import { enforceActionCapabilities, enforceNoFalseFollowUp, actionCapabilityInstruction } from '@/lib/agent-kernel/skills/action-capabilities'
import { showcaseIntroText } from '@/lib/products/presentation'
import { buildMessages } from '@/lib/ai/rag'

describe('back-in-stock: where the promise can be kept', () => {
  it('messengers deliver directly, web needs a phone, API never', () => {
    expect(restockMode('TELEGRAM', false)).toBe('direct')
    expect(restockMode('INSTAGRAM', false)).toBe('direct')
    expect(restockMode('WEB_WIDGET', true)).toBe('team')
    expect(restockMode('CHAT_LINK', false)).toBe('needs_phone')
    expect(restockMode('API', true)).toBeNull()
    expect(restockMode('WHATSAPP', true)).toBeNull()
  })

  it('offer wording matches who delivers it', () => {
    expect(restockOfferLine('direct', 'fa')).toContain('همین‌جا خبرتون می‌کنم')
    expect(restockOfferLine('team', 'fa')).toContain('خبرتون می‌کنیم')
    expect(restockOfferLine(null, 'fa')).toBeNull()
  })

  it('the conditional offer survives the false-follow-up guard', () => {
    const line = restockOfferLine('direct', 'fa')!
    expect(enforceNoFalseFollowUp(`فعلاً ناموجوده. ${line}`, true)).toContain(line)
  })
})

describe('back-in-stock: request detection', () => {
  it.each([
    'موجود شد خبرم کنید',
    'هر وقت اومد بهم خبر بدید',
    'اگه شارژ شد اطلاع بدید',
    'خبرم کن',
    'notify me when it is back',
  ])('explicit: «%s»', (message) => {
    expect(detectRestockRequest(message, null)).toBe('explicit')
  })

  it('a short yes counts only right after the agent’s offer', () => {
    const offer = 'فعلاً ناموجوده؛ اگه بخواید، موجود که شد همین‌جا خبرتون می‌کنم'
    expect(detectRestockRequest('آره لطفا', offer)).toBe('accept')
    expect(detectRestockRequest('حتما', offer)).toBe('accept')
    expect(detectRestockRequest('آره', 'قیمتش ۱۲ میلیونه')).toBeNull()
    expect(detectRestockRequest('آره ولی رنگ دیگه‌ای هم دارید؟ میخوام مقایسه کنم', offer)).toBeNull()
  })

  it('plain stock questions are not alert requests', () => {
    expect(detectRestockRequest('کی موجود میشه؟', null)).toBeNull()
    expect(detectRestockRequest('موجوده؟', null)).toBeNull()
  })
})

describe('back-in-stock: availability and messages', () => {
  const variable = {
    active: true,
    stock: null,
    attributes: { _variations: [
      { id: 11, attributes: { طرح: 'طرح 01' }, manageStock: true, stockQuantity: 0 },
      { id: 12, attributes: { طرح: 'طرح 02' }, manageStock: false, inStock: true },
    ] },
  }

  it('checks the exact variation when one is pinned', () => {
    expect(isItemAvailable(variable, 11)).toBe(false)
    expect(isItemAvailable(variable, 12)).toBe(true)
    expect(isItemAvailable(variable, null)).toBe(true)
    expect(isItemAvailable({ active: true, stock: 0, attributes: null }, null)).toBe(false)
    expect(isItemAvailable({ active: false, stock: 5, attributes: null }, null)).toBe(false)
  })

  it('confirmation and notice name the item and the next step', () => {
    const items = [{ productId: 'p', variationId: 11, name: 'پاف مراکشی', variant: 'طرح 01' }]
    expect(composeRestockConfirmed(items, 'direct', 'fa')).toContain('«پاف مراکشی — طرح 01»')
    const notice = composeRestockNotice({ items, customerName: 'سارا کریمی', orderCapture: true, lang: 'fa' })
    expect(notice).toMatch(/^سلام سارا!/)
    expect(notice).toContain('دوباره موجود شد')
    expect(notice).toContain('ثبتش کنم')
    expect(composeRestockNotice({ items, orderCapture: false, lang: 'fa' })).toContain('دکمهٔ خرید')
  })

  it('one alert per item per conversation', () => {
    expect(restockDedupeKey('c1', { productId: 'p', variationId: null })).toBe('c1:p:')
    expect(restockDedupeKey('c1', { productId: 'p', variationId: 7 })).toBe('c1:p:7')
  })
})

describe('back-in-stock offer reaches the model and the sold-out vitrine', () => {
  it('prompt carries the exact deliverable offer, or forbids it', () => {
    const base = {
      systemPrompt: 'x', language: 'fa', contextText: '', history: [], userMessage: 'پاف مراکشی دارید؟',
      catalogProducts: [{ id: 'p', name: 'پاف مراکشی', description: null, price: 1, stock: 0, category: null, image: null, url: null, attributes: null, tags: [], unavailable: true }],
      productRequest: { isProductTurn: true, explicitShowcase: false, resetProductContext: false, requestNewTopic: false, requestedCount: 3, inventoryMode: 'AVAILABLE' as const, unavailableMatch: true },
    }
    const withOffer = buildMessages({ ...base, restockOfferLine: 'اگه بخواید، موجود که شد همین‌جا خبرتون می‌کنم' })[0].content ?? ''
    expect(withOffer).toContain('«اگه بخواید، موجود که شد همین‌جا خبرتون می‌کنم»')
    const without = buildMessages(base)[0].content ?? ''
    expect(without).toContain('قول «موقع موجود شدن خبرتان می‌کنم» نده')
  })

  it('sold-out vitrine intro offers the alert when deliverable', () => {
    const text = showcaseIntroText({ count: 3, subject: 'پاف', unavailable: true, lang: 'fa', restockOffer: 'اگه بخواید، موجود که شد همین‌جا خبرتون می‌کنم' })
    expect(text).toContain('خبرتون می‌کنم')
    expect(showcaseIntroText({ count: 3, subject: 'پاف', unavailable: true, lang: 'fa' })).not.toContain('خبرتون')
  })
})

describe('catalog tools gate', () => {
  const plan = (message: string, overrides: Partial<ProductRequestPlan> = {}): ProductRequestPlan => ({
    ...planProductRequest(message, []),
    ...overrides,
  })

  it('price constraints and superlatives are recognised', () => {
    expect(PRICE_CONSTRAINT_RE.test('میز تلویزیون زیر ۲۰ میلیون دارید؟'.replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d))))).toBe(true)
    expect(PRICE_CONSTRAINT_RE.test('بودجه‌م 10 میلیونه')).toBe(true)
    expect(PRICE_CONSTRAINT_RE.test('میز ۱۶۰ دارید؟')).toBe(false)
    expect(SUPERLATIVE_RE.test('ارزون‌ترین میزتون کدومه')).toBe(true)
    expect(SUPERLATIVE_RE.test('ارزون ترین پاف')).toBe(true)
  })

  it('opens on budgets, superlatives and empty searches only', () => {
    const common = { productAccessEnabled: true, hasActiveProduct: false }
    expect(catalogToolGate({ ...common, message: 'میز تلویزیون زیر 20 میلیون دارید؟', plan: plan('میز تلویزیون زیر 20 میلیون دارید؟'), catalogProducts: [] })).toBe('PRICE_CONSTRAINT')
    expect(catalogToolGate({ ...common, message: 'ارزون‌ترین میز تلویزیون', plan: plan('ارزون‌ترین میز تلویزیون'), catalogProducts: [] })).toBe('SUPERLATIVE')
    expect(catalogToolGate({ ...common, message: 'میز تلویزیون دارید؟', plan: plan('میز تلویزیون دارید؟'), catalogProducts: [] })).toBe('EMPTY_RESULT')
    const row = { id: 'p', name: 'میز', description: null, price: 1, stock: 1, category: null, image: null, url: null, attributes: null, tags: [] }
    expect(catalogToolGate({ ...common, message: 'میز تلویزیون دارید؟', plan: plan('میز تلویزیون دارید؟'), catalogProducts: [row] })).toBeNull()
  })

  it('keeps deterministic flows and the kill switch', () => {
    const common = { productAccessEnabled: true, hasActiveProduct: true, catalogProducts: [] }
    expect(catalogToolGate({ ...common, message: 'ارزون‌ترش چی دارید', plan: plan('ارزون‌ترش چی دارید', { cheaperAlternative: true }) })).toBeNull()
    expect(catalogToolGate({ ...common, message: 'طرح 05', plan: plan('طرح 05', { variantPick: true }) })).toBeNull()
    expect(catalogToolGate({ ...common, productAccessEnabled: false, message: 'زیر 20 میلیون', plan: plan('میز زیر 20 میلیون') })).toBeNull()
    process.env.CATALOG_TOOLS_DISABLED = '1'
    expect(catalogToolGate({ ...common, message: 'میز زیر 20 میلیون', plan: plan('میز زیر 20 میلیون') })).toBeNull()
    delete process.env.CATALOG_TOOLS_DISABLED
  })

  it('parses budgets in Toman, server-side', () => {
    expect(parseBudget('یه میز جلومبلی زیر ۱۰ میلیون میخوام')).toEqual({ maxPrice: 10_000_000, minPrice: null })
    expect(parseBudget('بودجه‌م حدود ۱۵ میلیونه')).toEqual({ maxPrice: 15_000_000, minPrice: null })
    expect(parseBudget('تا ۸۰۰ هزار تومن')).toEqual({ maxPrice: 800_000, minPrice: null })
    expect(parseBudget('بین ۱۰ تا ۲۰ میلیون')).toEqual({ minPrice: 10_000_000, maxPrice: 20_000_000 })
    expect(parseBudget('بالای ۳۰ میلیون')).toEqual({ maxPrice: null, minPrice: 30_000_000 })
    expect(parseBudget('میز ۱۶۰ دارید؟')).toEqual({ maxPrice: null, minPrice: null })
    // Colloquial «۱۰ تومن» is ambiguous — never trusted as a price limit.
    expect(parseBudget('زیر ۱۰ تومن')).toEqual({ maxPrice: null, minPrice: null })
  })

  it('tool instructions go before the per-turn marker (prompt cache)', () => {
    const merged = insertBeforeTurnMarker('STABLE\n\n=== دستور همین نوبت ===\nTURN', '\n\nTOOLS')
    expect(merged).toBe('STABLE\n\nTOOLS\n\n=== دستور همین نوبت ===\nTURN')
  })
})

describe('capability guard with in-chat pre-orders', () => {
  it('without pre-orders the old honest fallback stays', () => {
    const out = enforceActionCapabilities({ reply: 'حتماً', userMessage: 'سفارش رو ثبت کنید', isFa: true })
    expect(out).toContain('فعلاً برای من فعال نیست')
  })

  it('with pre-orders an offer to set it up is allowed', () => {
    const reply = 'می‌تونم همین‌جا براتون ثبت کنم؛ می‌خواید؟'
    expect(enforceActionCapabilities({ reply, userMessage: 'ثبت سفارش', isFa: true, orderCaptureEnabled: true })).toBe(reply)
  })

  it('a fabricated completion is still stripped with pre-orders on', () => {
    const out = enforceActionCapabilities({ reply: 'سفارش شما ثبت شد و فردا ارسال می‌شه.', userMessage: 'بله', isFa: true, orderCaptureEnabled: true })
    expect(out).not.toContain('ثبت شد')
    expect(out).toContain('همین‌جا براتون ثبتش می‌کنم')
  })

  it('the capability instruction switches mode', () => {
    expect(actionCapabilityInstruction(true, true)).toContain('پیش‌سفارش درون‌چت')
    expect(actionCapabilityInstruction(true, false)).toContain('هیچ ابزار معتبری برای ثبت')
  })
})
