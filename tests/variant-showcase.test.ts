import { describe, expect, it } from 'vitest'
import { planProductRequest } from '@/lib/ai/conversation'
import {
  isVariationAvailable,
  matchVariationRow,
  parseProductDirectives,
  variationLabel,
} from '@/lib/products/presentation'
import { extractTypedVariations, type VariationRow } from '@/lib/products/description'
import type { ChatMessage } from '@/lib/ai/openrouter'

const user = (content: string): ChatMessage => ({ role: 'user', content })
const assistant = (content: string): ChatMessage => ({ role: 'assistant', content })

// Variation rows mirroring the real tonik 0788 shape (WooCommerce ingest).
const TARH = (id: number, n: string, qty: number, image: string): VariationRow => ({
  id,
  sku: `10705${n}110788`,
  price: 898000,
  regularPrice: 998000,
  salePrice: 898000,
  manageStock: true,
  stockQuantity: qty,
  inStock: qty > 0,
  attributes: { 'طرح': `طرح ${n}` },
  image,
})

const VARIATIONS = [
  TARH(77651, '05', 54, 'https://haftmin.shop/wp-content/uploads/9cd579fd8b949d605d933f44f5d361de-510x677.jpeg'),
  TARH(77647, '01', 24, 'https://haftmin.shop/wp-content/uploads/87d785ae2c9a6d3d320f31f37404b43e-510x680.jpeg'),
  TARH(77654, '08', 1, 'https://haftmin.shop/wp-content/uploads/6df116e853173009d55f49e6a95105e1-510x699.jpeg'),
  TARH(77677, '15', 0, 'https://haftmin.shop/wp-content/uploads/c10dc8f4862a02fdebb7be81d3a689ad-510x680.jpeg'),
]

describe('variant browse routing — «کاتالوگ طرح های دیگشو میفرستی»', () => {
  it.each([
    'کاتالوگ طرح های دیگشو میفرستی',
    'طرح هاشو بفرست',
    'طرحهاشو بفرست',
    'رنگ های دیگه دارین؟',
    'تنوع هاشو نشون بده',
    'عکس طرح های دیگه رو ببینم',
    'طرح هاش چیه؟',
    'show me the other designs',
    'can you send the other colors',
  ])('routes %s to the variant showcase', (message) => {
    const plan = planProductRequest(message, [])
    expect(plan.variantBrowse).toBe(true)
    expect(plan.isProductTurn).toBe(true)
    expect(plan.requestedCount).toBe(10)
    expect(plan.inventoryMode).toBe('AVAILABLE')
  })

  it.each([
    ['0788 طرح 05', 'singular variant pick stays a consultation'],
    ['طرح 05', 'bare singular variant'],
    ['رنگش چیه؟', 'possessive singular is not pluralized'],
    ['رنگی داره؟', 'has-color question'],
    ['سایز هاتون چیه؟', 'sizes excluded from variant nouns'],
    ['مدل های دیگه دارین؟', 'مدل excluded (means other products)'],
    ['رنگ هاش قشنگه', 'no browse cue'],
    ['سفارشم رو رسید کردین؟', 'order turn'],
    ['هزینه ارسال چقدره؟', 'policy turn'],
  ])('%s does NOT trigger variant browse (%s)', (message) => {
    expect(planProductRequest(message, []).variantBrowse).toBe(false)
  })

  it('«0788 طرح 05» carries a deterministic variant hint', () => {
    const plan = planProductRequest('0788 طرح 05', [])
    expect(plan.variantHint).toBe('05')
    expect(plan.variantBrowse).toBe(false)
    expect(plan.isProductTurn).toBe(true)
  })

  it.each([
    ['رنگ کرم بخوام', 'کرم'],
    ['طرح شماره ۵ رو بفرست', '5'],
    ['رنگ لیمویی موجوده؟', 'لیمویی'],
  ])('extracts the variant value from %s as %s', (message, expected) => {
    expect(planProductRequest(message, []).variantHint).toBe(expected)
  })

  it('browse turns never leak a variant hint', () => {
    expect(planProductRequest('طرح هاشو بفرست', []).variantHint).toBeNull()
  })
})

describe('variant browse target resolution from history', () => {
  const markerReply = (id: string, name: string) =>
    assistant(`تونیک روناز ۰۷۸۸ موجود است.\n[[product:{"id":"${id}","name":"${name}","price":"۸۹۸٬۰۰۰ تومان"}]]`)

  it('takes the product id from the most recent assistant product card', () => {
    const history = [
      user('شومیز'),
      assistant('[[product:{"id":"old1","name":"شومیز آریا"}]]'),
      user('0788 طرح 05'),
      markerReply('cmtu0nwbf02c6eo6m90heht4r', 'تونیک روناز 0788'),
    ]
    const plan = planProductRequest('کاتالوگ طرح های دیگشو میفرستی', history)
    expect(plan.variantBrowse).toBe(true)
    expect(plan.variantTargetRefs).toEqual(['cmtu0nwbf02c6eo6m90heht4r'])
  })

  it('falls back to the latest user product code when the consult reply had no card', () => {
    const history = [
      user('تونیک روناز 0788'),
      assistant('از ۱۵ طرح، طرح‌های ۰۱ تا ۱۲ موجود هستند.'),
      user('0788 طرح 05'),
      assistant('تونیک روناز ۰۷۸۸ طرح ۰۵ موجود (۵۴ عدد).'),
    ]
    const plan = planProductRequest('طرح هاشو بفرست', history)
    expect(plan.variantTargetRefs).toEqual(['0788'])
  })

  it('prefers the chronologically closest reference over an older showcase', () => {
    const history = [
      user('شومیز'),
      assistant('[[product:{"id":"old1","name":"شومیز آریا"}]]'),
      user('تونیک روناز 0788'),
      assistant('قیمتش ۸۹۸ هزار تومانه.'),
    ]
    const plan = planProductRequest('طرح های دیگشو میفرستی', history)
    expect(plan.variantTargetRefs).toEqual(['0788'])
  })

  it('searches with the prior discussion terms, not the plural variant nouns', () => {
    const history = [
      user('تونیک روناز 0788'),
      assistant('از ۱۵ طرح موجود گزارش دادم.'),
      user('0788 طرح 05'),
      assistant('موجود است.'),
    ]
    const plan = planProductRequest('کاتالوگ طرح های دیگشو میفرستی', history)
    expect(plan.searchTerms).toContain('0788')
    expect(plan.searchTerms).not.toContain('کاتالوگ')
    expect(plan.searchTerms).not.toContain('طرح')
  })

  it('collects nothing without product context', () => {
    const plan = planProductRequest('رنگ های دیگه دارین؟', [])
    expect(plan.variantBrowse).toBe(true)
    expect(plan.variantTargetRefs).toEqual([])
  })
})

describe('variation matching (parse + resolve helpers)', () => {
  it('extracts the variant field from a model marker', () => {
    const { directives } = parseProductDirectives(
      'کارت طرح ۵:\n[[product:{"id":"p1","name":"تونیک روناز 0788","variant":"طرح 05"}]]',
    )
    expect(directives).toHaveLength(1)
    expect(directives[0].variant).toBe('طرح 05')
  })

  it('matches by variation id from a «productId#v77651» directive id', () => {
    const match = matchVariationRow(VARIATIONS, { variationId: 77651, label: null })
    expect(match?.id).toBe(77651)
  })

  it('matches by exact label («طرح 05»)', () => {
    const match = matchVariationRow(VARIATIONS, { variationId: null, label: 'طرح 05' })
    expect(match?.id).toBe(77651)
  })

  it('matches a bare number hint («05») against «طرح 05»', () => {
    const match = matchVariationRow(VARIATIONS, { variationId: null, label: '05' })
    expect(match?.id).toBe(77651)
  })

  it('matches a leading-zero-dropped hint («طرح 5») against «طرح 05»', () => {
    const match = matchVariationRow(VARIATIONS, { variationId: null, label: 'طرح 5' })
    expect(match?.id).toBe(77651)
  })

  it('matches color words («کرم» → «رنگ کرم»)', () => {
    const colors: VariationRow[] = [
      { id: 1, attributes: { 'رنگ': 'کرم' }, manageStock: false, inStock: true, stockQuantity: null, price: 100 },
      { id: 2, attributes: { 'رنگ': 'قهوه ای' }, manageStock: false, inStock: false, stockQuantity: null, price: 100 },
    ]
    expect(matchVariationRow(colors, { variationId: null, label: 'کرم' })?.id).toBe(1)
  })

  it('returns null for a value that exists nowhere', () => {
    expect(matchVariationRow(VARIATIONS, { variationId: null, label: 'طرح 99' })).toBeNull()
    expect(matchVariationRow(VARIATIONS, { variationId: null, label: '' })).toBeNull()
  })

  it('availability respects manageStock + quantity, not just inStock', () => {
    expect(isVariationAvailable(VARIATIONS[0])).toBe(true) // qty 54
    expect(isVariationAvailable(VARIATIONS[3])).toBe(false) // qty 0
    expect(isVariationAvailable({ ...VARIATIONS[0], manageStock: false, stockQuantity: 0, inStock: true })).toBe(true)
  })

  it('labels a variation from its attribute values', () => {
    expect(variationLabel(VARIATIONS[0])).toBe('طرح 05')
  })

  it('keeps a unique per-variation card identity via the «#v<id>» marker id', () => {
    // Two directives for two variations of the SAME product must both survive
    // the id-based dedupe in the panel parser (ids differ).
    const ids = VARIATIONS.slice(0, 2).map((v) => `cmtu0nwbf02c6eo6m90heht4r#v${v.id}`)
    expect(new Set(ids).size).toBe(2)
  })

  it('parses variation ids back out of suffixed directive ids', () => {
    const { directives } = parseProductDirectives(
      '[[product:{"id":"cmtu0nwbf02c6eo6m90heht4r#v77651","name":"تونیک روناز 0788 — طرح 05"}]]',
    )
    expect(directives[0].id).toBe('cmtu0nwbf02c6eo6m90heht4r#v77651')
  })

  it('extractTypedVariations drops malformed entries and keeps order', () => {
    const rows = extractTypedVariations({
      'طرح': 'طرح 01, طرح 02',
      '_variations': [
        { id: 5, attributes: { 'طرح': 'طرح 01' }, image: 'https://x.test/1.jpg', price: 10, manageStock: true, stockQuantity: 3 },
        { id: 0, attributes: { 'طرح': 'bad' } },
        'not-an-object',
      ],
    })
    expect(rows).toHaveLength(1)
    expect(rows[0].id).toBe(5)
  })
})

describe('conversation reopen on new inbound (routing-level guards)', () => {
  // The DB-level reopen lives in persistInboundOnly/resolveConversation; here we
  // assert the plan layer never treats a resumed thread as a fresh topic.
  it('a follow-up on a resolved thread still plans a product turn', () => {
    const history = [user('تونیک روناز 0788'), assistant('[[product:{"id":"p1","name":"تونیک روناز 0788"}]]')]
    const plan = planProductRequest('طرح هاشو بفرست', history)
    expect(plan.requestNewTopic).toBe(false)
    expect(plan.isProductTurn).toBe(true)
  })
})

describe('variant pick routing — «طرح 07 رو میخوام» / «رنگ شکلاتی رو دارین؟»', () => {
  // A vitrine reply like the deterministic variant showcase sends.
  const vitrineHistory = [
    user('شلوار دامنی پرنسس 0556'),
    assistant(
      '۱۰ رنگ موجود را فرستادم.\n' +
      '[[product:{"id":"cmt9de4ew05u2eoqg26pshl8g#v70254","name":"شلوار دامنی پرنسس 0556 — موکا، L"}]]\n' +
      '[[product:{"id":"cmt9de4ew05u2eoqg26pshl8g#v70258","name":"شلوار دامنی پرنسس 0556 — شکلاتی، L"}]]',
    ),
  ]
  const consultHistory = [
    user('ست خانگی شادی 0736'),
    assistant('[[product:{"id":"cmta9kwh700rgeolm9tnafdjh","name":"ست خانگی شادی 0736"}]]'),
  ]

  it('routes a no-code variant pick of the discussed product', () => {
    const plan = planProductRequest('طرح 07 رو میخوام', consultHistory)
    expect(plan.variantHint).toBe('07')
    expect(plan.variantPick).toBe(true)
    expect(plan.variantTargetRefs).toContain('cmta9kwh700rgeolm9tnafdjh')
    expect(plan.isProductTurn).toBe(true)
  })

  it('«رنگ شکلاتی رو دارین؟» becomes a pick of the discussed product, not a catalog vitrine', () => {
    const plan = planProductRequest('رنگ شکلاتی رو دارین؟', vitrineHistory)
    expect(plan.variantHint).toBe('شکلاتی')
    expect(plan.variantPick).toBe(true)
    expect(plan.explicitShowcase).toBe(false)
    expect(plan.isProductTurn).toBe(true)
  })

  it('collects the vitrine markers (with «#v» suffixes) as pick refs', () => {
    const plan = planProductRequest('رنگ شکلاتی رو دارین؟', vitrineHistory)
    expect(plan.variantTargetRefs).toContain('cmt9de4ew05u2eoqg26pshl8g#v70254')
    expect(plan.variantTargetRefs).toContain('cmt9de4ew05u2eoqg26pshl8g#v70258')
  })

  it('«مدل 05» extracts a hint and picks the discussed product', () => {
    const plan = planProductRequest('مدل 05 رو میخوام', consultHistory)
    expect(plan.variantHint).toBe('05')
    expect(plan.variantPick).toBe(true)
  })

  it('«مدل دیگه ای دارین؟» stays a normal browse (blocked hint value)', () => {
    const plan = planProductRequest('مدل دیگه ای دارین؟', consultHistory)
    expect(plan.variantHint).toBeNull()
    expect(plan.variantPick).toBe(false)
  })

  it('pick turns search with the prior discussion terms, not the variant word', () => {
    const plan = planProductRequest('رنگ شکلاتی رو دارین؟', vitrineHistory)
    expect(plan.searchTerms).not.toContain('شکلاتی')
    expect(plan.searchTerms.some((term) => /0556|شلوار|پرنسس/.test(term))).toBe(true)
  })

  it('no product context — pick stays off (fresh conversations keep the ordinary routing)', () => {
    const plan = planProductRequest('رنگ شکلاتی رو دارین؟', [])
    expect(plan.variantPick).toBe(false)
  })

  it('reset turns never pick a variant', () => {
    const plan = planProductRequest('بیخیال رنگ شکلاتی رو دارین؟', vitrineHistory)
    expect(plan.variantPick).toBe(false)
  })

  it('order/policy turns never pick a variant', () => {
    expect(planProductRequest('سفارشم کی ارسال میشه طرح 05؟', vitrineHistory).variantPick).toBe(false)
    expect(planProductRequest('هزینه ارسال طرح 05 چقدره؟', vitrineHistory).variantPick).toBe(false)
  })
})
