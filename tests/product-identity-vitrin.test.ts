import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  agentCatalogFindMany: vi.fn(),
  pickTemplateImageUrl: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    agentCatalog: {
      findMany: mocks.agentCatalogFindMany,
    },
  },
}))
vi.mock('@/lib/instagram/media', () => ({
  pickTemplateImageUrl: mocks.pickTemplateImageUrl,
}))
vi.mock('@/lib/products/description', () => ({
  extractListItems: vi.fn(() => []),
  normalizeAttributes: vi.fn(() => []),
  stripListBlocks: vi.fn((value: string) => value),
}))

import { planProductRequest, showcaseSubjectPhrase } from '@/lib/ai/conversation'
import { buildTrustedProductReply } from '@/lib/products/presentation'

const catalogRow = (id: string, name: string) => ({
  product: {
    id,
    name,
    description: 'توضیح کوتاه محصول',
    price: 898_000,
    images: [`https://cdn.example/${id}.jpg`],
    externalUrl: `https://shop.example/p/${id}`,
    attributes: null,
  },
})

const RONAZ = 'ronaz-0788'
const PERIAN = 'perian-0649'

beforeEach(() => {
  vi.clearAllMocks()
  mocks.pickTemplateImageUrl.mockImplementation((images: string[]) => images?.[0] ?? null)
  mocks.agentCatalogFindMany.mockImplementation(() =>
    Promise.resolve([catalogRow(RONAZ, 'تونیک روناز 0788'), catalogRow(PERIAN, 'تونیک پریان 0649')]),
  )
})

// ─── Root cause 1: digit-script-insensitive product-name matching ───────────
// The catalog name is «تونیک روناز 0788» (ASCII digits). The model echoes the
// CUSTOMER's script, so its prose says «تونیک روناز ۰۷۸۸». The old
// normalizedProductMention never folded Persian digits, the exact-name
// recovery silently failed, and the reply shipped without any product card.
describe('product card hydration — digit-script-insensitive name matching', () => {
  it('attaches the card when the reply echoes the name with Persian digits', async () => {
    const reply = await buildTrustedProductReply({
      raw: 'تونیک روناز ۰۷۸۸ قیمتش ۸۹۸,۰۰۰ تومان و فری سایز است. کدوم طرح رو مد نظر دارید؟',
      workspaceId: 'ws',
      agentId: 'ag',
      isFa: true,
      preferredProductIds: [RONAZ, PERIAN],
    })
    expect(reply).toContain(`[[product:{"id":"${RONAZ}"`)
    expect((reply.match(/\[\[product:/g) ?? []).length).toBe(1)
  })

  it('attaches the card when the reply echoes the name with ASCII digits', async () => {
    const reply = await buildTrustedProductReply({
      raw: 'تونیک روناز 0788 قیمتش ۸۹۸,۰۰۰ تومان است.',
      workspaceId: 'ws',
      agentId: 'ag',
      isFa: true,
      preferredProductIds: [RONAZ],
    })
    expect(reply).toContain(`[[product:{"id":"${RONAZ}"`)
  })

  it('resolves a model-authored [[product:]] directive whose name uses Persian digits', async () => {
    const reply = await buildTrustedProductReply({
      raw: 'این مدل مناسب شماست.\n[[product:{"id":"","name":"تونیک روناز ۰۷۸۸"}]]',
      workspaceId: 'ws',
      agentId: 'ag',
      isFa: true,
    })
    expect(reply).toContain(`[[product:{"id":"${RONAZ}"`)
    expect(reply).toContain('"name":"تونیک روناز 0788"')
  })

  it('still skips cards when neither the name nor an identification is present', async () => {
    const reply = await buildTrustedProductReply({
      raw: 'سلام! در خدمتم؛ بگویید دنبال چه مدلی هستید.',
      workspaceId: 'ws',
      agentId: 'ag',
      isFa: true,
      preferredProductIds: [RONAZ, PERIAN],
    })
    expect(reply).not.toContain('[[product:')
  })
})

// ─── Root cause 2: identified products always get their vitrin card ─────────
// «تونیک روناز ۰۷۸۸» is a code-carrying consultation: the deterministic search
// proves which row the customer means, so that row's card must be attached
// even when the model paraphrases instead of echoing the exact catalog name.
describe('product card hydration — identified products are always presented', () => {
  it('attaches the identified card to a paraphrased consultation reply', async () => {
    const reply = await buildTrustedProductReply({
      raw: 'بله اون تونیک موجوده؛ قیمتش ۸۹۸ هزار تومانه. کدوم طرح رو میخوای؟',
      workspaceId: 'ws',
      agentId: 'ag',
      isFa: true,
      preferredProductIds: [RONAZ, PERIAN],
      identifiedProductIds: [RONAZ],
    })
    expect(reply).toContain(`[[product:{"id":"${RONAZ}"`)
    expect((reply.match(/\[\[product:/g) ?? []).length).toBe(1)
  })

  it('keeps the model prose and places the card after it', async () => {
    const reply = await buildTrustedProductReply({
      raw: 'قیمتش ۸۹۸,۰۰۰ تومان است و طرح ۰۱ تا ۱۲ موجود هستند.',
      workspaceId: 'ws',
      agentId: 'ag',
      isFa: true,
      preferredProductIds: [RONAZ],
      identifiedProductIds: [RONAZ],
    })
    const [prose, marker] = reply.split('\n\n[[product:')
    expect(prose).toContain('۸۹۸')
    expect(marker).toContain(`"id":"${RONAZ}"`)
  })

  it('works when only identifiedProductIds are passed (no preferred list)', async () => {
    const reply = await buildTrustedProductReply({
      raw: 'این مدل الان موجوده.',
      workspaceId: 'ws',
      agentId: 'ag',
      isFa: true,
      identifiedProductIds: [RONAZ],
    })
    expect(reply).toContain(`[[product:{"id":"${RONAZ}"`)
  })

  it('narrows a forced showcase to exactly the identified product', async () => {
    const reply = await buildTrustedProductReply({
      raw: '',
      workspaceId: 'ws',
      agentId: 'ag',
      isFa: true,
      preferredProductIds: [RONAZ, PERIAN],
      identifiedProductIds: [RONAZ],
      forceShowcase: true,
      subjectPhrase: 'تونیک',
    })
    expect((reply.match(/\[\[product:/g) ?? []).length).toBe(1)
    expect(reply).toContain(`"id":"${RONAZ}"`)
    expect(reply).toContain('یک مدل تونیک')
  })

  it('falls back to the full preferred vitrin when nothing is identified', async () => {
    const reply = await buildTrustedProductReply({
      raw: '',
      workspaceId: 'ws',
      agentId: 'ag',
      isFa: true,
      preferredProductIds: [RONAZ, PERIAN],
      forceShowcase: true,
      subjectPhrase: 'تونیک',
    })
    expect((reply.match(/\[\[product:/g) ?? []).length).toBe(2)
  })
})

// ─── Root cause 3: «X رو بفرست» must not be hijacked as shipping policy ────
describe('routing — a product send command is a showcase, not a shipping question', () => {
  it('routes a named product + «رو بفرست» to an explicit showcase', () => {
    const plan = planProductRequest('تونیک روناز ۰۷۸۸ رو بفرست', [])
    expect(plan.isProductTurn).toBe(true)
    expect(plan.explicitShowcase).toBe(true)
    expect(plan.searchTerms).toContain('0788')
    expect(plan.codeIdentified).toBe(true)
  })

  it('routes a subject noun + «رو بفرست» to an explicit showcase', () => {
    const plan = planProductRequest('کفش رو بفرست', [])
    expect(plan.isProductTurn).toBe(true)
    expect(plan.explicitShowcase).toBe(true)
  })

  it.each([
    ['سفارشم رو با پست بفرست', 'fulfilment with carrier'],
    ['سفارش رو با اسنپ بفرستید', 'carrier request'],
    ['نحوه ارسال کفش چطوره؟', 'shipping method naming a product'],
    ['مرسولم رو با تیپاکس میفرستین؟', 'parcel + carrier'],
  ])('keeps %s a policy/order turn (%s), never a showcase', (message) => {
    const plan = planProductRequest(message, [])
    expect(plan.explicitShowcase).toBe(false)
  })

  it.each([
    'هزینه ارسال کتاب چقدره؟',
    'ارسال رایگان برای کفش دارین؟',
    'فروشگاه با اسنپ هم ارسال می‌کنه؟',
    'گوشی با باربری میفرستین؟',
  ])('never turns the shipping phrase %s into a product turn', (message) => {
    expect(planProductRequest(message, []).isProductTurn).toBe(false)
  })
})

// ─── The plan carries identification evidence for the presentation layer ────
describe('plan — code queries expose identification evidence', () => {
  it('marks Persian-digit codes as identified evidence', () => {
    const plan = planProductRequest('تونیک روناز ۰۷۸۸', [])
    expect(plan.isProductTurn).toBe(true)
    expect(plan.explicitShowcase).toBe(false) // consultation, not a bare phrase
    expect(plan.codeIdentified).toBe(true)
    expect(plan.searchTerms).toContain('0788')
    expect(showcaseSubjectPhrase(plan)).toBe('تونیک')
  })

  it('marks «کد …» labelled codes as identified evidence', () => {
    const plan = planProductRequest('کد 0742 رو دارین؟', [])
    expect(plan.codeIdentified).toBe(true)
    expect(plan.searchTerms).toContain('0742')
  })

  it.each([
    'شومیز',
    'کیف دوشی دارین؟',
    'سارافان مجلسی',
    'تونیک',
    'شومیز مجلسی چنه؟',
  ])('does not identify bare phrases and price questions (%s)', (message) => {
    expect(planProductRequest(message, []).codeIdentified).toBe(false)
  })

  it('keeps non-catalog codes out of the identification path', () => {
    expect(planProductRequest('کد پیگیری 1234', []).codeIdentified).toBe(false)
    expect(planProductRequest('شماره تماس 09123456789', []).codeIdentified).toBe(false)
  })
})

// ─── Possessive suffixes: «دامنش» must search for «دامن» ────────────────────
describe('term extraction — bare possessive suffixes fold back to the noun', () => {
  it('strips «ش» so a possessive phrase still finds the catalog noun', () => {
    expect(planProductRequest('دامنش که عکس گذاشتین موجوده', []).searchTerms).toContain('دامن')
    expect(planProductRequest('تونیکش موجوده؟', []).searchTerms).toContain('تونیک')
  })

  it('never corrupts a real word that merely ends with «ش»', () => {
    // «ابریشمش» (its silk) strips to «ابریشم», which is not a known noun, so
    // the token must survive unchanged instead of becoming a bogus term.
    const terms = planProductRequest('پیراهن ابریشمش دارین؟', []).searchTerms
    expect(terms).toContain('ابریشمش')
    // «ستون» would strip to the 1-letter «س»; the base check and singular
    // fallback keep it whole.
    expect(planProductRequest('ستون جدید گذاشتین؟', []).searchTerms).not.toContain('س')
  })

  it('covers the common سارافان spelling beside سارافون', () => {
    const plan = planProductRequest('سارافان مجلسی', [])
    expect(plan.isProductTurn).toBe(true)
    expect(plan.explicitShowcase).toBe(true)
    expect(plan.requestedCount).toBe(10)
  })

  it('folds a 4-letter possessive such as «کیفش» back to its noun', () => {
    expect(planProductRequest('کیفش قشنگه', []).searchTerms).toContain('کیف')
  })
})

// ─── Regression: the existing vitrin behaviors stay intact ──────────────────
describe('regression — vitrin routing is unchanged for existing shapes', () => {
  it('sends the 10-card vitrin for bare phrases', () => {
    for (const message of ['شومیز', 'کیف دوشی دارین؟', 'سارافان مجلسی']) {
      const plan = planProductRequest(message, [])
      expect(plan.explicitShowcase).toBe(true)
      expect(plan.requestedCount).toBe(10)
      expect(plan.inventoryMode).toBe('AVAILABLE')
    }
  })

  it('keeps price/size/policy/opinion turns consultations', () => {
    for (const message of [
      'قیمت شومیز آریا چنده؟',
      'شومیز سایز ۴۸ دارین؟',
      'شومیز با پست ارسال میشه؟',
      'شومیز رو دوست نداشتم',
    ]) {
      const plan = planProductRequest(message, [])
      expect(plan.explicitShowcase).toBe(false)
    }
  })
})
