/**
 * A customer names a product by a piece of its name: «مدل ۴۳۱» for «اسپرسو ساز
 * دلونگی مدل BCO431», «فیلیپس ۳۵۰» for «… فیلیپس مدل NA350», «اسپرسوساز» for a
 * row the store wrote «اسپرسو ساز» (live conversation, 2026-10-12).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const catalog = vi.hoisted(() => ({ rows: [] as Array<Record<string, unknown>> }))
vi.mock('@/lib/prisma', () => ({
  prisma: { product: { findMany: vi.fn(async () => catalog.rows) } },
}))
vi.mock('@/lib/search/attribute-lane', () => ({ attributeLaneIds: vi.fn(async () => []) }))

import { extractProductTerms, fetchCatalogProducts, modelNumberIn, tokenizeCatalogText } from '@/lib/ai/conversation'
import { emptyProductPlan, routeFromUnderstanding } from '@/lib/agent/turn/route'
import { verifyUnderstanding } from '@/lib/agent/understand/verify'
import { createEmptyConversationWorkingState } from '@/lib/ai/conversation-state'
import type { Act, TurnCandidates } from '@/lib/agent/understand/types'

const NAMES = [
  'اسپرسو ساز دلونگی مدل BCO431',
  'اسپرسو ساز دلونگی مدل BCO421',
  'اسپرسوساز دلونگی مدل EC685.B',
  'اسپرسوساز دلونگی مدل EC685.M',
  'سرخ کن بدون روغن فیلیپس مدل NA350',
  'کتری برقی فیلیپس مدل HD9350',
  'سرخ کن فیلیپس مدل HD9285/96',
  'چای ساز ماهسونیک مدل MTM-271',
  'آبمیوه گیری کنوود مدل JEM02',
  'آب میوه گیری کنوود مدل JEP02',
  'جاروبرقی فیلیپس مدل FC9170',
]
const VOCABULARY = new Set(NAMES.flatMap((name) => tokenizeCatalogText(name)))

beforeEach(() => {
  catalog.rows = NAMES.map((name, index) => ({
    id: `p${index}`, name, description: null, price: 1_000_000, stock: null, images: [], externalUrl: null,
    sku: null, tags: [], attributes: {}, queryCount: 0, updatedAt: new Date(0), category: null,
  }))
})

const search = async (terms: string[]) => {
  const plan = {
    ...emptyProductPlan(), isProductTurn: true, searchTerms: terms, requestedCount: 5, inventoryMode: 'ANY' as const,
    corpusSubjectTerms: terms.filter((term) => VOCABULARY.has(term)),
  }
  return fetchCatalogProducts('agent', [], plan, VOCABULARY)
}
const names = (rows: Array<{ name: string }>) => rows.map((row) => row.name)

describe('a number that is part of a model name', () => {
  it('stands in a name as a whole number, with or without letters attached', () => {
    expect(modelNumberIn('اسپرسو ساز دلونگی مدل bco431', '431')).toBe('model')
    expect(modelNumberIn('اسپرسوساز دلونگی مدل ec685.b', '685')).toBe('model')
    expect(modelNumberIn('چای ساز ماهسونیک مدل mtm-271', '271')).toBe('word')
    expect(modelNumberIn('میز تلویزیون 160', '160')).toBe('word')
  })

  it('is never a slice of a longer number', () => {
    expect(modelNumberIn('کتری برقی فیلیپس مدل hd9350', '350')).toBeNull()
    expect(modelNumberIn('شومیز 1070611', '0706')).toBeNull()
    expect(modelNumberIn('اسپرسو ساز دلونگی مدل bco431', '43')).toBeNull()
  })

  it('«مدل ۴۳۱» finds BCO431 and nothing else', async () => {
    const rows = await search(['اسپرسوساز', 'دلونگی', '431'])
    expect(names(rows)).toEqual(['اسپرسو ساز دلونگی مدل BCO431'])
    expect(rows[0].fullTermMatch).toBe(true)
  })

  it('«فیلیپس ۳۵۰» is NA350, not HD9350', async () => {
    expect(names(await search(['فیلیپس', '350']))).toEqual(['سرخ کن بدون روغن فیلیپس مدل NA350'])
  })

  it('«دلونگی ۶۸۵» lists both EC685 colours', async () => {
    expect(names(await search(['دلونگی', '685'])).sort()).toEqual(['اسپرسوساز دلونگی مدل EC685.B', 'اسپرسوساز دلونگی مدل EC685.M'])
  })

  it('«۶۸۵ مشکی» as a typed code keeps the EC685 rows, not the other black products', async () => {
    catalog.rows.push({
      id: 'black', name: 'اسپرسوساز اسمگ مشکی مات مدل BCC02', description: null, price: 1_000_000, stock: null, images: [],
      externalUrl: null, sku: null, tags: [], attributes: {}, queryCount: 50, updatedAt: new Date(0), category: null,
    })
    const plan = { ...emptyProductPlan(), isProductTurn: true, searchTerms: ['مشکی', '685'], requestedCount: 5, inventoryMode: 'ANY' as const, codeIdentified: true }
    const rows = await fetchCatalogProducts('agent', [], plan, new Set([...VOCABULARY, 'مشکی']))
    expect(names(rows).sort()).toEqual(['اسپرسوساز دلونگی مدل EC685.B', 'اسپرسوساز دلونگی مدل EC685.M'])
    expect(rows.every((row) => row.nearMatch === true)).toBe(true)
  })

  it('a number no model carries finds no exact row', async () => {
    const rows = await search(['اسپرسوساز', '999'])
    expect(rows.every((row) => row.nearMatch === true)).toBe(true)
  })
})

describe('one word here, two words there', () => {
  it('«اسپرسوساز دلونگی» reaches the rows written «اسپرسو ساز»', async () => {
    expect(names(await search(['اسپرسوساز', 'دلونگی'])).sort()).toEqual([
      'اسپرسو ساز دلونگی مدل BCO421', 'اسپرسو ساز دلونگی مدل BCO431', 'اسپرسوساز دلونگی مدل EC685.B', 'اسپرسوساز دلونگی مدل EC685.M',
    ])
  })

  it('«آب میوه گیری» and «آبمیوه گیری» are the same product type', async () => {
    const both = ['آب میوه گیری کنوود مدل JEP02', 'آبمیوه گیری کنوود مدل JEM02']
    expect(names(await search(['آبمیوه', 'گیری', 'کنوود'])).sort()).toEqual(both)
    expect(names(await search(['آب', 'میوه', 'گیری', 'کنوود'])).sort()).toEqual(both)
  })

  it('«جارو برقی» finds «جاروبرقی»', async () => {
    expect(names(await search(['جارو', 'برقی', 'فیلیپس']))).toEqual(['جاروبرقی فیلیپس مدل FC9170'])
  })
})

describe('numbers in the reader\'s product words are search terms', () => {
  const candidates: TurnCandidates = {
    capabilities: ['products'], pending: null, task: null, shownCards: [], cart: [], active: null, seen: [],
    services: [], courses: [], vocabulary: [...VOCABULARY], categories: [],
  }
  const route = (message: string, acts: Act[], recentText = '') => {
    const verified = verifyUnderstanding({
      understanding: { v: 1, language: 'fa', relation: 'refinement', acts, answersPending: false, customer: { mood: 'neu', buy: 1, cues: [] }, confidence: 0.9 },
      candidates, message, recentText, vocabulary: VOCABULARY,
    })
    return routeFromUnderstanding({ verified, candidates, message, state: createEmptyConversationWorkingState(), corpusTokens: VOCABULARY, lang: 'fa' })
  }

  it('«مدل ۴۳۱ هم دارید؟» after «اسپرسوساز دلونگی دارید؟» searches for 431', () => {
    const { productPlan } = route('مدل ۴۳۱ هم دارید؟', [{ type: 'product_search', terms: ['اسپرسوساز دلونگی مدل ۴۳۱'], display: 'consult' }], 'اسپرسوساز دلونگی دارید؟')
    expect(productPlan?.searchTerms).toEqual(['اسپرسوساز', 'دلونگی', '431'])
  })

  it('a typed code is a term even with no other word', () => {
    const { productPlan } = route('۴۳۱ چنده؟', [{ type: 'product_search', terms: [], code: '431', display: 'consult' }])
    expect(productPlan?.searchTerms).toEqual(['431'])
    expect(productPlan?.codeIdentified).toBe(true)
  })

  it('a count stays a count, and the raw message keeps its own rules', () => {
    expect(extractProductTerms('۱۲ تا اسپرسوساز', { productWordsOnly: true })).toEqual(['اسپرسوساز'])
    expect(extractProductTerms('۱۰۰ عدد اسپرسوساز', { productWordsOnly: true })).toEqual(['اسپرسوساز'])
    expect(extractProductTerms('آیفون ۱۶ پرو', { productWordsOnly: true })).toEqual(['آیفون', 'پرو'])
    expect(extractProductTerms('فیلیپس ۳۵۰')).toEqual(['فیلیپس'])
    expect(extractProductTerms('فیلیپس ۳۵۰', { productWordsOnly: true })).toEqual(['فیلیپس', '350'])
  })
})
