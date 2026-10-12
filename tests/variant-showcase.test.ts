import { describe, expect, it } from 'vitest'
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
